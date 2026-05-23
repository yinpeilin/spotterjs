//! Desktop application discovery (aggregate windows by process).

use crate::error::{Result, SpotterError};
use crate::types::{DesktopApp, WindowInfo};
use crate::window::{get_active_window, list_windows};
use std::collections::HashMap;
use std::thread;
use std::time::{Duration, Instant};

/// List running desktop applications (one entry per process ID).
pub fn list_desktop_apps() -> Result<Vec<DesktopApp>> {
    let windows = list_windows()?;
    Ok(aggregate_apps(windows))
}

fn aggregate_apps(windows: Vec<WindowInfo>) -> Vec<DesktopApp> {
    let mut by_pid: HashMap<u32, DesktopApp> = HashMap::new();
    for w in windows {
        let entry = by_pid.entry(w.process_id).or_insert_with(|| DesktopApp {
            process_id: w.process_id,
            process_name: w.process_name.clone(),
            exe_path: w.exe_path.clone(),
            windows: Vec::new(),
            is_foreground: false,
        });
        if w.is_foreground {
            entry.is_foreground = true;
        }
        if entry.process_name == "unknown" && w.process_name != "unknown" {
            entry.process_name = w.process_name.clone();
        }
        if entry.exe_path.is_none() {
            entry.exe_path = w.exe_path.clone();
        }
        entry.windows.push(w);
    }
    let mut apps: Vec<DesktopApp> = by_pid.into_values().collect();
    apps.sort_by(|a, b| {
        a.process_name
            .to_lowercase()
            .cmp(&b.process_name.to_lowercase())
    });
    apps
}

/// Find visible windows whose title contains `substring` (case-insensitive).
pub fn find_windows(title_contains: &str) -> Result<Vec<WindowInfo>> {
    let needle = title_contains.to_lowercase();
    Ok(list_windows()?
        .into_iter()
        .filter(|w| w.title.to_lowercase().contains(&needle))
        .collect())
}

/// Find apps whose process name or any window title contains `substring`.
pub fn find_apps(title_contains: &str) -> Result<Vec<DesktopApp>> {
    let needle = title_contains.to_lowercase();
    Ok(list_desktop_apps()?
        .into_iter()
        .filter(|a| {
            a.process_name.to_lowercase().contains(&needle)
                || a.windows
                    .iter()
                    .any(|w| w.title.to_lowercase().contains(&needle))
        })
        .collect())
}

/// Wait until a window title contains `substring`, then return that window.
pub fn wait_for_window(title_contains: &str, timeout_ms: u64, poll_ms: u64) -> Result<WindowInfo> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let poll = Duration::from_millis(poll_ms.max(50));
    loop {
        if let Some(w) = find_windows(title_contains)?.into_iter().next() {
            return Ok(w);
        }
        if Instant::now() >= deadline {
            return Err(SpotterError::WindowNotFound(format!(
                "no window matching '{title_contains}' within {timeout_ms}ms"
            )));
        }
        thread::sleep(poll);
    }
}

/// Return the desktop app that owns the current foreground window.
pub fn get_foreground_app() -> Result<DesktopApp> {
    let active = get_active_window()?;
    let apps = list_desktop_apps()?;
    apps.into_iter()
        .find(|a| a.process_id == active.process_id)
        .ok_or_else(|| SpotterError::WindowNotFound("foreground app not found".into()))
}
