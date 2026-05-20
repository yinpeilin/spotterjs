use crate::error::Result;
use crate::platform::{platform, PlatformWindow};
use crate::types::{WindowId, WindowInfo};

pub fn list_windows() -> Result<Vec<WindowInfo>> {
    platform()?.list_windows()
}

pub fn get_active_window() -> Result<WindowInfo> {
    platform()?.active_window()
}

pub fn focus_window(id: WindowId) -> Result<()> {
    platform()?.focus_window(id)
}

pub fn get_window_region(id: WindowId) -> Result<crate::types::Region> {
    platform()?.window_region(id)
}

pub fn get_window_region_clamped(id: WindowId) -> Result<crate::types::Region> {
    platform()?.window_region_clamped(id)
}

/// Screen position of the window client-area origin (matches capture / in-window match coords).
pub fn get_window_client_origin(id: WindowId) -> Result<(i32, i32)> {
    #[cfg(windows)]
    {
        return crate::platform::windows::WindowsPlatform::client_screen_origin(id);
    }
    let r = get_window_region(id)?;
    Ok((r.left, r.top))
}

pub fn move_window(id: WindowId, x: i32, y: i32) -> Result<()> {
    platform()?.move_window(id, x, y)
}

pub fn resize_window(id: WindowId, width: i32, height: i32) -> Result<()> {
    platform()?.resize_window(id, width, height)
}

pub fn minimize_window(id: WindowId) -> Result<()> {
    platform()?.minimize_window(id)
}

pub fn restore_window(id: WindowId) -> Result<()> {
    platform()?.restore_window(id)
}

pub fn parse_window_id(s: &str) -> Result<WindowId> {
    WindowId::from_str(s).ok_or_else(|| crate::error::SpotterError::InvalidWindowId(s.to_string()))
}
