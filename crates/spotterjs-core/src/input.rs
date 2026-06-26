use crate::error::Result;
#[cfg(not(windows))]
use crate::error::SpotterError;
use crate::types::{MouseButton, Point};
use std::thread;
use std::time::Duration;

#[cfg(not(windows))]
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Mouse, Settings};
#[cfg(not(windows))]
use std::sync::Mutex;

#[derive(Debug, Clone, Copy)]
pub struct MouseConfig {
    pub auto_delay_ms: u64,
    pub mouse_speed: u32,
}

impl Default for MouseConfig {
    fn default() -> Self {
        Self {
            auto_delay_ms: 10,
            mouse_speed: 1000,
        }
    }
}

#[cfg(not(windows))]
static MOUSE_CONFIG: Mutex<MouseConfig> = Mutex::new(MouseConfig {
    auto_delay_ms: 10,
    mouse_speed: 1000,
});

#[cfg(windows)]
static MOUSE_CONFIG: std::sync::Mutex<MouseConfig> = std::sync::Mutex::new(MouseConfig {
    auto_delay_ms: 10,
    mouse_speed: 1000,
});

pub fn mouse_config() -> MouseConfig {
    *MOUSE_CONFIG.lock().unwrap()
}

pub fn set_mouse_config(config: MouseConfig) {
    *MOUSE_CONFIG.lock().unwrap() = config;
}

#[cfg(not(windows))]
fn enigo() -> Result<Enigo> {
    Enigo::new(&Settings::default()).map_err(|e| SpotterError::Platform(format!("enigo init: {e}")))
}

#[cfg(not(windows))]
fn to_enigo_button(button: MouseButton) -> Button {
    match button {
        MouseButton::Left => Button::Left,
        MouseButton::Right => Button::Right,
        MouseButton::Middle => Button::Middle,
    }
}

fn auto_delay() {
    let ms = mouse_config().auto_delay_ms;
    if ms > 0 {
        thread::sleep(Duration::from_millis(ms));
    }
}

pub fn mouse_get_position() -> Result<(i32, i32)> {
    #[cfg(windows)]
    {
        return crate::platform::windows_input::mouse_get_position();
    }
    #[cfg(not(windows))]
    {
        let e = enigo()?;
        e.location()
            .map_err(|err| SpotterError::Platform(format!("mouse_get_position: {err}")))
    }
}

pub fn mouse_move(x: i32, y: i32) -> Result<()> {
    crate::events::guard::guard_synthetic_input(|| {
        #[cfg(windows)]
        {
            crate::platform::windows_input::mouse_move(x, y)?;
            auto_delay();
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let mut e = enigo()?;
            e.move_mouse(x, y, Coordinate::Abs)
                .map_err(|err| SpotterError::Platform(format!("mouse_move: {err}")))?;
            auto_delay();
            Ok(())
        }
    })
}

pub fn mouse_move_path(points: &[(i32, i32)]) -> Result<()> {
    if points.is_empty() {
        return Ok(());
    }
    if points.len() == 1 {
        return mouse_move(points[0].0, points[0].1);
    }

    let cfg = mouse_config();
    let (start_x, start_y) = mouse_get_position().unwrap_or(points[0]);
    let mut from = (start_x, start_y);

    for &(to_x, to_y) in points {
        let dx = to_x - from.0;
        let dy = to_y - from.1;
        let dist = ((dx * dx + dy * dy) as f64).sqrt();
        let steps = ((dist / cfg.mouse_speed.max(1) as f64) * 60.0).ceil() as i32;
        let steps = steps.clamp(1, 500);

        for step in 1..=steps {
            let t = step as f64 / steps as f64;
            let x = from.0 + (dx as f64 * t).round() as i32;
            let y = from.1 + (dy as f64 * t).round() as i32;
            mouse_move(x, y)?;
        }
        from = (to_x, to_y);
    }
    Ok(())
}

pub fn mouse_press(button: MouseButton) -> Result<()> {
    crate::events::guard::guard_synthetic_input(|| {
        #[cfg(windows)]
        {
            crate::platform::windows_input::mouse_press(button)?;
            auto_delay();
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let mut e = enigo()?;
            e.button(to_enigo_button(button), Direction::Press)
                .map_err(|err| SpotterError::Platform(format!("mouse_press: {err}")))?;
            auto_delay();
            Ok(())
        }
    })
}

pub fn mouse_release(button: MouseButton) -> Result<()> {
    crate::events::guard::guard_synthetic_input(|| {
        #[cfg(windows)]
        {
            crate::platform::windows_input::mouse_release(button)?;
            auto_delay();
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let mut e = enigo()?;
            e.button(to_enigo_button(button), Direction::Release)
                .map_err(|err| SpotterError::Platform(format!("mouse_release: {err}")))?;
            auto_delay();
            Ok(())
        }
    })
}

pub fn mouse_click(button: MouseButton) -> Result<()> {
    mouse_press(button)?;
    mouse_release(button)
}

pub fn mouse_double_click(button: MouseButton) -> Result<()> {
    mouse_click(button)?;
    mouse_click(button)
}

pub fn mouse_scroll_up(amount: i32) -> Result<()> {
    mouse_scroll(-amount, true)
}

pub fn mouse_scroll_down(amount: i32) -> Result<()> {
    mouse_scroll(amount, true)
}

pub fn mouse_scroll_left(amount: i32) -> Result<()> {
    mouse_scroll(-amount, false)
}

pub fn mouse_scroll_right(amount: i32) -> Result<()> {
    mouse_scroll(amount, false)
}

fn mouse_scroll(length: i32, vertical: bool) -> Result<()> {
    crate::events::guard::guard_synthetic_input(|| {
        #[cfg(windows)]
        {
            crate::platform::windows_input::mouse_scroll(length, vertical)?;
            auto_delay();
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let mut e = enigo()?;
            let axis = if vertical {
                Axis::Vertical
            } else {
                Axis::Horizontal
            };
            e.scroll(length, axis)
                .map_err(|err| SpotterError::Platform(format!("mouse_scroll: {err}")))?;
            auto_delay();
            Ok(())
        }
    })
}

pub fn mouse_drag_to(x: i32, y: i32, button: MouseButton) -> Result<()> {
    mouse_press(button)?;
    mouse_move(x, y)?;
    mouse_release(button)
}

pub fn tap_at(x: i32, y: i32, button: MouseButton) -> Result<()> {
    mouse_move(x, y)?;
    thread::sleep(Duration::from_millis(30));
    mouse_press(button)?;
    thread::sleep(Duration::from_millis(25));
    mouse_release(button)
}

pub fn straight_line_points(from: Point, to: Point, step_px: i32) -> Vec<Point> {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dist = ((dx * dx + dy * dy) as f64).sqrt();
    let steps = (dist / step_px.max(1) as f64).ceil() as i32;
    let steps = steps.clamp(1, 500);
    (0..=steps)
        .map(|i| {
            let t = i as f64 / steps as f64;
            Point {
                x: from.x + (dx as f64 * t).round() as i32,
                y: from.y + (dy as f64 * t).round() as i32,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn straight_line_points_includes_endpoints() {
        let pts = straight_line_points(Point { x: 0, y: 0 }, Point { x: 10, y: 0 }, 5);
        assert_eq!(pts.first().map(|p| (p.x, p.y)), Some((0, 0)));
        assert_eq!(pts.last().map(|p| (p.x, p.y)), Some((10, 0)));
        assert!(pts.len() >= 2);
    }

    #[test]
    fn straight_line_points_clamps_zero_step() {
        let pts = straight_line_points(Point { x: 0, y: 0 }, Point { x: 3, y: 4 }, 0);
        assert_eq!(pts.last().map(|p| (p.x, p.y)), Some((3, 4)));
    }
}
