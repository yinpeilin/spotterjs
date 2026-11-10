//! Win32 mouse in virtual-screen pixels (matches `GetWindowRect` on multi-monitor setups).

use crate::error::{Result, SpotterError};
use crate::types::MouseButton;
use std::mem::size_of;
use std::sync::Once;
use std::thread;
use windows::Win32::Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, POINT};
use windows::Win32::System::StationsAndDesktops::{
    CloseDesktop, OpenInputDesktop, SetThreadDesktop, DESKTOP_ACCESS_FLAGS, DESKTOP_CONTROL_FLAGS,
    DESKTOP_JOURNALPLAYBACK, DESKTOP_READOBJECTS, DESKTOP_WRITEOBJECTS, HDESK,
};
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
    MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
    MOUSEEVENTF_WHEEL, MOUSEINPUT,
};
use windows::Win32::UI::WindowsAndMessaging::{GetCursorPos, SetCursorPos};
#[cfg(test)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN,
};

static DPI_INIT: Once = Once::new();

pub fn ensure_dpi_aware() {
    DPI_INIT.call_once(|| unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    });
}

fn win32_error(api: &str, error: windows::core::Error) -> SpotterError {
    let code = unsafe { GetLastError().0 };
    let reason = if code == 0 {
        "API returned failure without a Win32 error code".to_string()
    } else {
        error.to_string()
    };
    SpotterError::Platform(format!(
        "{api} failed [win32Error={code}, hresult=0x{:08X}]: {reason}",
        error.code().0 as u32
    ))
}

pub(super) struct InputDesktop(pub(super) HDESK);

impl Drop for InputDesktop {
    fn drop(&mut self) {
        // The retry thread has exited before this owned handle is closed.
        unsafe {
            let _ = CloseDesktop(self.0);
        }
    }
}

/// Retry on the input desktop without changing the host thread's desktop.
/// Electron and other hosts may already own windows/hooks, which prevent
/// SetThreadDesktop on the calling thread. A fresh thread has neither.
fn with_input_desktop_retry<T: Send>(operation: impl Fn() -> Result<T> + Send + Sync) -> Result<T> {
    let first_error = match operation() {
        Ok(value) => return Ok(value),
        Err(error) => error,
    };

    retry_on_input_desktop(
        first_error,
        DESKTOP_ACCESS_FLAGS(DESKTOP_READOBJECTS.0 | DESKTOP_WRITEOBJECTS.0),
        operation,
    )
}

fn retry_on_input_desktop<T: Send>(
    first_error: SpotterError,
    access: DESKTOP_ACCESS_FLAGS,
    operation: impl FnOnce() -> Result<T> + Send,
) -> Result<T> {
    // Capture on the original calling thread, before the recovery thread can
    // change the evidence. The error is already saved, so diagnostics cannot
    // overwrite the failed operation's last-error.
    let before = super::windows_input_diagnostics::snapshot();
    let retry = || -> std::result::Result<T, (&'static str, SpotterError)> {
        let desktop = InputDesktop(unsafe {
            SetLastError(ERROR_SUCCESS);
            OpenInputDesktop(DESKTOP_CONTROL_FLAGS::default(), false, access)
                .map_err(|e| ("openInputDesktop", win32_error("OpenInputDesktop", e)))?
        });
        // Desktop handles can be used by other threads in the same process.
        // Keep ownership here until the scoped thread has terminated.
        let raw_desktop = (desktop.0).0 as usize;
        thread::scope(|scope| {
            thread::Builder::new()
                .name("spotter-input-retry".into())
                .spawn_scoped(scope, move || {
                    unsafe {
                        SetLastError(ERROR_SUCCESS);
                        SetThreadDesktop(HDESK(raw_desktop as *mut _)).map_err(|e| {
                            ("bindInputDesktop", win32_error("SetThreadDesktop", e))
                        })?;
                    }
                    operation().map_err(|error| ("inputOperation", error))
                })
                .map_err(|e| {
                    (
                        "spawnInputThread",
                        SpotterError::Platform(format!("spawn input desktop thread: {e}")),
                    )
                })?
                .join()
                .map_err(|_| {
                    (
                        "joinInputThread",
                        SpotterError::Platform("input desktop thread panicked".into()),
                    )
                })?
        })
    };

    retry().map_err(|failure| input_error(first_error, Some(failure), before))
}

fn input_error(
    initial: SpotterError,
    retry: Option<(&str, SpotterError)>,
    mut diagnostics: serde_json::Value,
) -> SpotterError {
    let initial_error = initial.to_string();
    let retry_stage = retry.as_ref().map(|(stage, _)| *stage);
    let retry_error = retry.as_ref().map(|(_, error)| error.to_string());
    let recovery = if let Some((stage, error)) = retry {
        format!("input desktop retry failed at {stage}: {error}")
    } else {
        "partially accepted input was not replayed to avoid duplicate input".into()
    };
    let summary = format!(
        "processId={}, threadId={}, sessionId={}, windowStation={}, threadDesktop={}, \
         inputDesktop={}, threadDesktopMatchesInput={}, foregroundWindow={}, diagnosticErrors={}",
        diagnostics["processId"],
        diagnostics["threadId"],
        diagnostics["sessionId"],
        diagnostics["windowStation"],
        diagnostics["threadDesktop"],
        diagnostics["inputDesktop"],
        diagnostics["threadDesktopMatchesInput"],
        diagnostics["foregroundWindow"],
        diagnostics["errors"],
    );
    diagnostics["initialError"] = serde_json::json!(initial_error);
    diagnostics["retryAttempted"] = serde_json::json!(retry_stage.is_some());
    diagnostics["retryStage"] = serde_json::json!(retry_stage);
    diagnostics["retryError"] = serde_json::json!(retry_error);
    SpotterError::PlatformDiagnostics {
        reason: format!(
            "{initial_error}; {recovery}. Input context: {summary}. \
             Check the interactive session and target application permissions; desktop names \
             alone do not prove the cause or that input is allowed"
        ),
        diagnostics,
    }
}

pub(crate) fn send_inputs(label: &str, inputs: &[INPUT]) -> Result<()> {
    let send = || {
        let sent = unsafe {
            SetLastError(ERROR_SUCCESS);
            SendInput(inputs, size_of::<INPUT>() as i32)
        };
        let result = if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err(SpotterError::Platform(format!(
                "{label}: SendInput sent {sent}/{} events: {}",
                inputs.len(),
                std::io::Error::last_os_error()
            )))
        };
        (sent, result)
    };
    let (sent, result) = send();
    match result {
        // A partially sent batch must not be replayed: that could duplicate
        // password characters or shortcut keys. Retry only a rejected batch.
        Err(error) if sent == 0 => retry_on_input_desktop(
            error,
            // SendInput additionally requires journal playback access on the
            // desktop handle used to bind the retry thread.
            DESKTOP_ACCESS_FLAGS(
                DESKTOP_READOBJECTS.0 | DESKTOP_WRITEOBJECTS.0 | DESKTOP_JOURNALPLAYBACK.0,
            ),
            || send().1,
        ),
        Err(error) => Err(input_error(
            error,
            None,
            super::windows_input_diagnostics::snapshot(),
        )),
        result => result,
    }
}

fn cursor_position() -> Result<(i32, i32)> {
    unsafe {
        let mut pt = POINT::default();
        // Some desktop failures leave last-error unchanged. Do not report an
        // unrelated stale error (e.g. ERROR_ENVVAR_NOT_FOUND from Node.js).
        SetLastError(ERROR_SUCCESS);
        GetCursorPos(&mut pt).map_err(|e| win32_error("GetCursorPos", e))?;
        Ok((pt.x, pt.y))
    }
}

#[cfg(test)]
fn virtual_desk() -> (i32, i32, i32, i32) {
    unsafe {
        (
            GetSystemMetrics(SM_XVIRTUALSCREEN),
            GetSystemMetrics(SM_YVIRTUALSCREEN),
            GetSystemMetrics(SM_CXVIRTUALSCREEN),
            GetSystemMetrics(SM_CYVIRTUALSCREEN),
        )
    }
}

#[cfg(test)]
fn mul_div(a: i32, num: i32, den: i32) -> i32 {
    if den <= 0 {
        return 0;
    }
    ((a as i64 * num as i64) / den as i64) as i32
}

/// Virtual-desktop normalization (used by unit tests only).
#[cfg(test)]
fn to_normalized(x: i32, y: i32) -> (i32, i32) {
    let (vx, vy, vw, vh) = virtual_desk();
    let nx = mul_div(x - vx, 65535, vw.saturating_sub(1).max(1));
    let ny = mul_div(y - vy, 65535, vh.saturating_sub(1).max(1));
    (nx, ny)
}

#[cfg(test)]
fn from_normalized(nx: i32, ny: i32) -> (i32, i32) {
    let (vx, vy, vw, vh) = virtual_desk();
    let x = vx + mul_div(nx, vw.saturating_sub(1).max(1), 65535);
    let y = vy + mul_div(ny, vh.saturating_sub(1).max(1), 65535);
    (x, y)
}

pub fn mouse_get_position() -> Result<(i32, i32)> {
    ensure_dpi_aware();
    with_input_desktop_retry(cursor_position)
}

pub fn mouse_move(x: i32, y: i32) -> Result<()> {
    ensure_dpi_aware();
    with_input_desktop_retry(|| unsafe {
        SetLastError(ERROR_SUCCESS);
        SetCursorPos(x, y).map_err(|e| win32_error("SetCursorPos", e))
    })
}

fn button_event(button: MouseButton, down: bool) -> Result<()> {
    let flags = match (button, down) {
        (MouseButton::Left, true) => MOUSEEVENTF_LEFTDOWN,
        (MouseButton::Left, false) => MOUSEEVENTF_LEFTUP,
        (MouseButton::Right, true) => MOUSEEVENTF_RIGHTDOWN,
        (MouseButton::Right, false) => MOUSEEVENTF_RIGHTUP,
        (MouseButton::Middle, true) => MOUSEEVENTF_MIDDLEDOWN,
        (MouseButton::Middle, false) => MOUSEEVENTF_MIDDLEUP,
    };
    send_inputs(
        "mouse button",
        &[INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        }],
    )
}

pub fn mouse_press(button: MouseButton) -> Result<()> {
    button_event(button, true)
}

pub fn mouse_release(button: MouseButton) -> Result<()> {
    button_event(button, false)
}

pub fn mouse_scroll(length: i32, vertical: bool) -> Result<()> {
    if !vertical {
        return Err(SpotterError::Platform(
            "horizontal scroll not implemented on Windows".into(),
        ));
    }
    send_inputs(
        "mouse wheel",
        &[INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dwFlags: MOUSEEVENTF_WHEEL,
                    mouseData: (length * 120) as u32,
                    ..Default::default()
                },
            },
        }],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalized_origin_on_virtual_desk_is_zero() {
        let (vx, vy, _, _) = virtual_desk();
        let (nx, ny) = to_normalized(vx, vy);
        assert_eq!(nx, 0);
        assert_eq!(ny, 0);
    }

    #[test]
    fn normalized_roundtrip_within_one_pixel() {
        let (vx, vy, vw, vh) = virtual_desk();
        let samples = [
            (vx, vy),
            (vx + vw / 2, vy + vh / 2),
            (vx + vw - 1, vy + vh - 1),
            (2203, 418),
        ];
        for (x, y) in samples {
            let (nx, ny) = to_normalized(x, y);
            let (rx, ry) = from_normalized(nx, ny);
            assert!(
                (rx - x).abs() <= 1 && (ry - y).abs() <= 1,
                "roundtrip ({x},{y}) -> ({nx},{ny}) -> ({rx},{ry})"
            );
        }
    }
}
