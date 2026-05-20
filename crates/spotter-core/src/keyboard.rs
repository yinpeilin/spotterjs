use crate::error::{Result, SpotterError};
use enigo::{Direction, Enigo, Key as EnigoKey, Keyboard, Settings};
use std::str::FromStr;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Key {
    Enter,
    Tab,
    Escape,
    Space,
    Backspace,
    Delete,
    Up,
    Down,
    Left,
    Right,
    Home,
    End,
    PageUp,
    PageDown,
    F1,
    F2,
    F3,
    F4,
    F5,
    F6,
    F7,
    F8,
    F9,
    F10,
    F11,
    F12,
    LeftControl,
    RightControl,
    LeftShift,
    RightShift,
    LeftAlt,
    RightAlt,
    LeftSuper,
    RightSuper,
    /// Single ASCII letter (a–z), for shortcuts like Ctrl+F
    Letter(char),
}

impl FromStr for Key {
    type Err = SpotterError;

    fn from_str(s: &str) -> Result<Self> {
        match s.trim() {
            "Enter" | "Return" => Ok(Key::Enter),
            "Tab" => Ok(Key::Tab),
            "Escape" | "Esc" => Ok(Key::Escape),
            "Space" => Ok(Key::Space),
            "Backspace" => Ok(Key::Backspace),
            "Delete" => Ok(Key::Delete),
            "Up" => Ok(Key::Up),
            "Down" => Ok(Key::Down),
            "Left" => Ok(Key::Left),
            "Right" => Ok(Key::Right),
            "Home" => Ok(Key::Home),
            "End" => Ok(Key::End),
            "PageUp" => Ok(Key::PageUp),
            "PageDown" => Ok(Key::PageDown),
            "F1" => Ok(Key::F1),
            "F2" => Ok(Key::F2),
            "F3" => Ok(Key::F3),
            "F4" => Ok(Key::F4),
            "F5" => Ok(Key::F5),
            "F6" => Ok(Key::F6),
            "F7" => Ok(Key::F7),
            "F8" => Ok(Key::F8),
            "F9" => Ok(Key::F9),
            "F10" => Ok(Key::F10),
            "F11" => Ok(Key::F11),
            "F12" => Ok(Key::F12),
            "LeftControl" | "Control" | "Ctrl" => Ok(Key::LeftControl),
            "RightControl" => Ok(Key::RightControl),
            "LeftShift" | "Shift" => Ok(Key::LeftShift),
            "RightShift" => Ok(Key::RightShift),
            "LeftAlt" | "Alt" => Ok(Key::LeftAlt),
            "RightAlt" => Ok(Key::RightAlt),
            "LeftSuper" | "Meta" | "Win" | "Cmd" => Ok(Key::LeftSuper),
            "RightSuper" => Ok(Key::RightSuper),
            other if other.len() == 1 => {
                let c = other.chars().next().unwrap();
                if c.is_ascii_alphabetic() {
                    Ok(Key::Letter(c.to_ascii_lowercase()))
                } else {
                    Err(SpotterError::Platform(format!("unknown key: {other}")))
                }
            }
            other => Err(SpotterError::Platform(format!("unknown key: {other}"))),
        }
    }
}

impl Key {
    pub fn to_enigo(self) -> EnigoKey {
        match self {
            Key::Enter => EnigoKey::Return,
            Key::Tab => EnigoKey::Tab,
            Key::Escape => EnigoKey::Escape,
            Key::Space => EnigoKey::Space,
            Key::Backspace => EnigoKey::Backspace,
            Key::Delete => EnigoKey::Delete,
            Key::Up => EnigoKey::UpArrow,
            Key::Down => EnigoKey::DownArrow,
            Key::Left => EnigoKey::LeftArrow,
            Key::Right => EnigoKey::RightArrow,
            Key::Home => EnigoKey::Home,
            Key::End => EnigoKey::End,
            Key::PageUp => EnigoKey::PageUp,
            Key::PageDown => EnigoKey::PageDown,
            Key::F1 => EnigoKey::F1,
            Key::F2 => EnigoKey::F2,
            Key::F3 => EnigoKey::F3,
            Key::F4 => EnigoKey::F4,
            Key::F5 => EnigoKey::F5,
            Key::F6 => EnigoKey::F6,
            Key::F7 => EnigoKey::F7,
            Key::F8 => EnigoKey::F8,
            Key::F9 => EnigoKey::F9,
            Key::F10 => EnigoKey::F10,
            Key::F11 => EnigoKey::F11,
            Key::F12 => EnigoKey::F12,
            Key::LeftControl | Key::RightControl => EnigoKey::Control,
            Key::LeftShift | Key::RightShift => EnigoKey::Shift,
            Key::LeftAlt | Key::RightAlt => EnigoKey::Alt,
            Key::LeftSuper | Key::RightSuper => EnigoKey::Meta,
            Key::Letter(c) => EnigoKey::Unicode(c),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct KeyboardConfig {
    pub auto_delay_ms: u64,
}

impl Default for KeyboardConfig {
    fn default() -> Self {
        Self { auto_delay_ms: 10 }
    }
}

static KEYBOARD_CONFIG: Mutex<KeyboardConfig> = Mutex::new(KeyboardConfig {
    auto_delay_ms: 10,
});

pub fn keyboard_config() -> KeyboardConfig {
    *KEYBOARD_CONFIG.lock().unwrap()
}

pub fn set_keyboard_config(config: KeyboardConfig) {
    *KEYBOARD_CONFIG.lock().unwrap() = config;
}

fn enigo() -> Result<Enigo> {
    Enigo::new(&Settings::default())
        .map_err(|e| SpotterError::Platform(format!("enigo init: {e}")))
}

fn auto_delay() {
    let ms = keyboard_config().auto_delay_ms;
    if ms > 0 {
        thread::sleep(Duration::from_millis(ms));
    }
}

pub fn keyboard_type(text: &str) -> Result<()> {
    let mut e = enigo()?;
    e.text(text)
        .map_err(|err| SpotterError::Platform(format!("keyboard_type: {err}")))?;
    auto_delay();
    Ok(())
}

pub fn keyboard_press(keys: &[Key]) -> Result<()> {
    let mut e = enigo()?;
    for key in keys {
        e.key(key.to_enigo(), Direction::Press)
            .map_err(|err| SpotterError::Platform(format!("keyboard_press: {err}")))?;
    }
    auto_delay();
    Ok(())
}

pub fn keyboard_release(keys: &[Key]) -> Result<()> {
    let mut e = enigo()?;
    for key in keys.iter().rev() {
        e.key(key.to_enigo(), Direction::Release)
            .map_err(|err| SpotterError::Platform(format!("keyboard_release: {err}")))?;
    }
    auto_delay();
    Ok(())
}

pub fn keyboard_type_keys(keys: &[Key]) -> Result<()> {
    if keys.is_empty() {
        return Ok(());
    }
    if keys.len() == 1 {
        let mut e = enigo()?;
        e.key(keys[0].to_enigo(), Direction::Click)
            .map_err(|err| SpotterError::Platform(format!("keyboard_type_keys: {err}")))?;
        auto_delay();
        return Ok(());
    }
    keyboard_press(keys)?;
    let mut e = enigo()?;
    e.key(keys[keys.len() - 1].to_enigo(), Direction::Click)
        .map_err(|err| SpotterError::Platform(format!("keyboard_type_keys: {err}")))?;
    keyboard_release(keys)
}

pub fn parse_key(s: &str) -> Result<Key> {
    Key::from_str(s)
}

pub fn parse_keys(names: &[String]) -> Result<Vec<Key>> {
    names.iter().map(|s| parse_key(s)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_common_keys() {
        assert_eq!(parse_key("Enter").unwrap(), Key::Enter);
        assert_eq!(parse_key("LeftControl").unwrap(), Key::LeftControl);
        assert_eq!(parse_key("F5").unwrap(), Key::F5);
    }

    #[test]
    fn parse_key_aliases() {
        assert_eq!(parse_key("Return").unwrap(), Key::Enter);
        assert_eq!(parse_key("Ctrl").unwrap(), Key::LeftControl);
        assert_eq!(parse_key("Esc").unwrap(), Key::Escape);
    }

    #[test]
    fn parse_unknown_key_errors() {
        assert!(parse_key("NotARealKey").is_err());
    }
}
