//! Win32 mouse in virtual-screen pixels (matches `GetWindowRect` on multi-monitor setups).

use crate::error::{Result, SpotterError};
use crate::types::MouseButton;
use std::sync::Once;
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    mouse_event, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN,
    MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL,
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
    unsafe {
        let mut pt = POINT::default();
        GetCursorPos(&mut pt).map_err(|e| SpotterError::Platform(format!("GetCursorPos: {e}")))?;
        Ok((pt.x, pt.y))
    }
}

pub fn mouse_move(x: i32, y: i32) -> Result<()> {
    ensure_dpi_aware();
    unsafe {
        SetCursorPos(x, y).map_err(|e| SpotterError::Platform(format!("SetCursorPos: {e}")))?;
    }
    Ok(())
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
    unsafe {
        mouse_event(flags, 0, 0, 0, 0);
    }
    Ok(())
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
    unsafe {
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, length * 120, 0);
    }
    Ok(())
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
