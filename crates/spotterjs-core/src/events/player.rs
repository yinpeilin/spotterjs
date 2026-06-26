use crate::error::Result;
use crate::events::guard::guard_synthetic_input;
use crate::events::recorder::{RecordedScript, ScriptAction};
use crate::keyboard::parse_key;
use crate::types::MouseButton;
use std::thread;
use std::time::Duration;

pub trait PlaybackTarget {
    fn move_mouse(&mut self, x: i32, y: i32) -> Result<()>;
    fn click(&mut self, button: &str, x: i32, y: i32) -> Result<()>;
    fn scroll(&mut self, dx: i32, dy: i32) -> Result<()>;
    fn key_down(&mut self, key: &str) -> Result<()>;
    fn key_up(&mut self, key: &str) -> Result<()>;
    fn type_text(&mut self, text: &str) -> Result<()>;
}

pub struct NativePlaybackTarget;

impl PlaybackTarget for NativePlaybackTarget {
    fn move_mouse(&mut self, x: i32, y: i32) -> Result<()> {
        crate::input::mouse_move(x, y)
    }

    fn click(&mut self, button: &str, x: i32, y: i32) -> Result<()> {
        crate::input::tap_at(x, y, mouse_button_from_name(button))
    }

    fn scroll(&mut self, dx: i32, dy: i32) -> Result<()> {
        if dx > 0 {
            crate::input::mouse_scroll_right(dx)?;
        } else if dx < 0 {
            crate::input::mouse_scroll_left(dx.abs())?;
        }
        if dy > 0 {
            crate::input::mouse_scroll_up(dy)?;
        } else if dy < 0 {
            crate::input::mouse_scroll_down(dy.abs())?;
        }
        Ok(())
    }

    fn key_down(&mut self, key: &str) -> Result<()> {
        let key = parse_key(key)?;
        crate::keyboard::keyboard_press(&[key])
    }

    fn key_up(&mut self, key: &str) -> Result<()> {
        let key = parse_key(key)?;
        crate::keyboard::keyboard_release(&[key])
    }

    fn type_text(&mut self, text: &str) -> Result<()> {
        crate::keyboard::keyboard_type(text)
    }
}

pub fn play_script(script: &RecordedScript, speed: f64) -> Result<()> {
    let mut target = NativePlaybackTarget;
    guard_synthetic_input(|| play_script_with(script, speed, &mut target, thread::sleep))
}

pub fn play_script_json(script_json: &str, speed: f64) -> Result<()> {
    let script: RecordedScript = serde_json::from_str(script_json)
        .map_err(|e| crate::error::SpotterError::Image(e.to_string()))?;
    play_script(&script, speed)
}

pub fn play_script_with<T, S>(
    script: &RecordedScript,
    speed: f64,
    target: &mut T,
    mut sleep: S,
) -> Result<()>
where
    T: PlaybackTarget,
    S: FnMut(Duration),
{
    let speed = if speed.is_finite() {
        speed.clamp(0.05, 20.0)
    } else {
        1.0
    };

    for action in &script.events {
        let delay = scaled_delay(action.delay_ms(), speed);
        if delay > Duration::ZERO {
            sleep(delay);
        }
        dispatch_action(action, target)?;
    }
    Ok(())
}

fn dispatch_action<T: PlaybackTarget>(action: &ScriptAction, target: &mut T) -> Result<()> {
    match action {
        ScriptAction::Move { x, y, .. } => target.move_mouse(*x, *y),
        ScriptAction::Click { button, x, y, .. } => target.click(button, *x, *y),
        ScriptAction::Scroll { dx, dy, .. } => target.scroll(*dx, *dy),
        ScriptAction::KeyDown { key, .. } => target.key_down(key),
        ScriptAction::KeyUp { key, .. } => target.key_up(key),
        ScriptAction::Type { text, .. } => target.type_text(text),
    }
}

fn scaled_delay(delay_ms: u64, speed: f64) -> Duration {
    if delay_ms == 0 {
        return Duration::ZERO;
    }
    Duration::from_millis(((delay_ms as f64) / speed).round().max(0.0) as u64)
}

fn mouse_button_from_name(button: &str) -> MouseButton {
    match button {
        "right" => MouseButton::Right,
        "middle" => MouseButton::Middle,
        _ => MouseButton::Left,
    }
}
