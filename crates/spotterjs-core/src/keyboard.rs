use crate::error::{Result, SpotterError};
use enigo::{Direction, Enigo, Key as EnigoKey, Keyboard, Settings};
#[cfg(windows)]
use std::mem::size_of;
use std::str::FromStr;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, VIRTUAL_KEY, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, VK_0, VK_1, VK_2, VK_3, VK_4, VK_5, VK_6, VK_7, VK_8, VK_9, VK_A, VK_B,
    VK_BACK, VK_C, VK_D, VK_DELETE, VK_DOWN, VK_E, VK_END, VK_ESCAPE, VK_F, VK_F1, VK_F10,
    VK_F11, VK_F12, VK_F2, VK_F3, VK_F4, VK_F5, VK_F6, VK_F7, VK_F8, VK_F9, VK_G, VK_H,
    VK_HOME, VK_I, VK_J, VK_K, VK_L, VK_LCONTROL, VK_LEFT, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_M,
    VK_N, VK_NEXT, VK_O, VK_P, VK_PRIOR, VK_Q, VK_R, VK_RCONTROL, VK_RETURN, VK_RIGHT, VK_RMENU,
    VK_RSHIFT, VK_RWIN, VK_S, VK_SPACE, VK_T, VK_TAB, VK_U, VK_UP, VK_V, VK_W, VK_X, VK_Y, VK_Z,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Key {
    Digit(char),
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
        let trimmed = s.trim();
        let normalized = trimmed.to_ascii_lowercase();
        match normalized.as_str() {
            "enter" | "return" => Ok(Key::Enter),
            "tab" => Ok(Key::Tab),
            "escape" | "esc" => Ok(Key::Escape),
            "space" => Ok(Key::Space),
            "backspace" => Ok(Key::Backspace),
            "delete" => Ok(Key::Delete),
            "up" => Ok(Key::Up),
            "down" => Ok(Key::Down),
            "left" => Ok(Key::Left),
            "right" => Ok(Key::Right),
            "home" => Ok(Key::Home),
            "end" => Ok(Key::End),
            "pageup" => Ok(Key::PageUp),
            "pagedown" => Ok(Key::PageDown),
            "f1" => Ok(Key::F1),
            "f2" => Ok(Key::F2),
            "f3" => Ok(Key::F3),
            "f4" => Ok(Key::F4),
            "f5" => Ok(Key::F5),
            "f6" => Ok(Key::F6),
            "f7" => Ok(Key::F7),
            "f8" => Ok(Key::F8),
            "f9" => Ok(Key::F9),
            "f10" => Ok(Key::F10),
            "f11" => Ok(Key::F11),
            "f12" => Ok(Key::F12),
            "leftcontrol" | "control" | "ctrl" => Ok(Key::LeftControl),
            "rightcontrol" => Ok(Key::RightControl),
            "leftshift" | "shift" => Ok(Key::LeftShift),
            "rightshift" => Ok(Key::RightShift),
            "leftalt" | "alt" => Ok(Key::LeftAlt),
            "rightalt" => Ok(Key::RightAlt),
            "leftsuper" | "meta" | "win" | "cmd" => Ok(Key::LeftSuper),
            "rightsuper" => Ok(Key::RightSuper),
            _ if trimmed.len() == 1 => {
                let c = trimmed.chars().next().unwrap();
                if c.is_ascii_digit() {
                    Ok(Key::Digit(c))
                } else if c.is_ascii_alphabetic() {
                    Ok(Key::Letter(c.to_ascii_lowercase()))
                } else {
                    Err(SpotterError::Platform(format!("unknown key: {trimmed}")))
                }
            }
            _ => Err(SpotterError::Platform(format!("unknown key: {trimmed}"))),
        }
    }
}

impl Key {
    pub fn to_enigo(self) -> EnigoKey {
        match self {
            Key::Digit(c) => digit_to_enigo(c),
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
            Key::LeftControl => EnigoKey::LControl,
            Key::RightControl => EnigoKey::RControl,
            Key::LeftShift => EnigoKey::LShift,
            Key::RightShift => EnigoKey::RShift,
            Key::LeftAlt => EnigoKey::LMenu,
            Key::RightAlt => EnigoKey::RMenu,
            Key::LeftSuper => EnigoKey::LWin,
            Key::RightSuper => EnigoKey::RWin,
            Key::Letter(c) => letter_to_enigo(c),
        }
    }
}

fn letter_to_enigo(c: char) -> EnigoKey {
    match c.to_ascii_lowercase() {
        'a' => EnigoKey::A,
        'b' => EnigoKey::B,
        'c' => EnigoKey::C,
        'd' => EnigoKey::D,
        'e' => EnigoKey::E,
        'f' => EnigoKey::F,
        'g' => EnigoKey::G,
        'h' => EnigoKey::H,
        'i' => EnigoKey::I,
        'j' => EnigoKey::J,
        'k' => EnigoKey::K,
        'l' => EnigoKey::L,
        'm' => EnigoKey::M,
        'n' => EnigoKey::N,
        'o' => EnigoKey::O,
        'p' => EnigoKey::P,
        'q' => EnigoKey::Q,
        'r' => EnigoKey::R,
        's' => EnigoKey::S,
        't' => EnigoKey::T,
        'u' => EnigoKey::U,
        'v' => EnigoKey::V,
        'w' => EnigoKey::W,
        'x' => EnigoKey::X,
        'y' => EnigoKey::Y,
        'z' => EnigoKey::Z,
        _ => EnigoKey::Unicode(c),
    }
}

fn digit_to_enigo(c: char) -> EnigoKey {
    #[cfg(windows)]
    {
        match c {
            '0' => EnigoKey::Num0,
            '1' => EnigoKey::Num1,
            '2' => EnigoKey::Num2,
            '3' => EnigoKey::Num3,
            '4' => EnigoKey::Num4,
            '5' => EnigoKey::Num5,
            '6' => EnigoKey::Num6,
            '7' => EnigoKey::Num7,
            '8' => EnigoKey::Num8,
            '9' => EnigoKey::Num9,
            _ => EnigoKey::Unicode(c),
        }
    }
    #[cfg(not(windows))]
    {
        EnigoKey::Unicode(c)
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

static KEYBOARD_CONFIG: Mutex<KeyboardConfig> = Mutex::new(KeyboardConfig { auto_delay_ms: 10 });

pub fn keyboard_config() -> KeyboardConfig {
    *KEYBOARD_CONFIG.lock().unwrap()
}

pub fn set_keyboard_config(config: KeyboardConfig) {
    *KEYBOARD_CONFIG.lock().unwrap() = config;
}

fn enigo() -> Result<Enigo> {
    Enigo::new(&Settings::default()).map_err(|e| SpotterError::Platform(format!("enigo init: {e}")))
}

fn auto_delay_for(config: KeyboardConfig) {
    let ms = config.auto_delay_ms;
    if ms > 0 {
        thread::sleep(Duration::from_millis(ms));
    }
}

pub fn keyboard_type(text: &str) -> Result<()> {
    keyboard_type_with_config(text, None)
}

pub fn keyboard_type_with_config(text: &str, config: Option<KeyboardConfig>) -> Result<()> {
    let mut e = enigo()?;
    e.text(text)
        .map_err(|err| SpotterError::Platform(format!("keyboard_type: {err}")))?;
    auto_delay_for(config.unwrap_or_else(keyboard_config));
    Ok(())
}

pub fn keyboard_press(keys: &[Key]) -> Result<()> {
    keyboard_press_with_config(keys, None)
}

pub fn keyboard_press_with_config(keys: &[Key], config: Option<KeyboardConfig>) -> Result<()> {
    let mut e = enigo()?;
    for key in keys {
        e.key(key.to_enigo(), Direction::Press)
            .map_err(|err| SpotterError::Platform(format!("keyboard_press: {err}")))?;
    }
    auto_delay_for(config.unwrap_or_else(keyboard_config));
    Ok(())
}

pub fn keyboard_release(keys: &[Key]) -> Result<()> {
    keyboard_release_with_config(keys, None)
}

pub fn keyboard_release_with_config(keys: &[Key], config: Option<KeyboardConfig>) -> Result<()> {
    let mut e = enigo()?;
    for key in keys.iter().rev() {
        e.key(key.to_enigo(), Direction::Release)
            .map_err(|err| SpotterError::Platform(format!("keyboard_release: {err}")))?;
    }
    auto_delay_for(config.unwrap_or_else(keyboard_config));
    Ok(())
}

pub fn keyboard_type_keys(keys: &[Key]) -> Result<()> {
    keyboard_type_keys_with_config(keys, None)
}

pub fn keyboard_type_keys_with_config(keys: &[Key], config: Option<KeyboardConfig>) -> Result<()> {
    if keys.is_empty() {
        return Ok(());
    }
    let cfg = config.unwrap_or_else(keyboard_config);
    if keys.len() == 1 {
        let mut e = enigo()?;
        e.key(keys[0].to_enigo(), Direction::Click)
            .map_err(|err| SpotterError::Platform(format!("keyboard_type_keys: {err}")))?;
        auto_delay_for(cfg);
        return Ok(());
    }
    #[cfg(windows)]
    {
        send_windows_shortcut(keys)?;
        auto_delay_for(cfg);
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let modifiers = &keys[..keys.len() - 1];
        keyboard_press_with_config(modifiers, Some(cfg))?;
        let mut e = enigo()?;
        e.key(keys[keys.len() - 1].to_enigo(), Direction::Click)
            .map_err(|err| SpotterError::Platform(format!("keyboard_type_keys: {err}")))?;
        keyboard_release_with_config(modifiers, Some(cfg))
    }
}

#[cfg(windows)]
fn windows_vk(key: Key) -> VIRTUAL_KEY {
    match key {
        Key::Digit('0') => VK_0,
        Key::Digit('1') => VK_1,
        Key::Digit('2') => VK_2,
        Key::Digit('3') => VK_3,
        Key::Digit('4') => VK_4,
        Key::Digit('5') => VK_5,
        Key::Digit('6') => VK_6,
        Key::Digit('7') => VK_7,
        Key::Digit('8') => VK_8,
        Key::Digit('9') => VK_9,
        Key::Digit(c) => VIRTUAL_KEY(c as u16),
        Key::Enter => VK_RETURN,
        Key::Tab => VK_TAB,
        Key::Escape => VK_ESCAPE,
        Key::Space => VK_SPACE,
        Key::Backspace => VK_BACK,
        Key::Delete => VK_DELETE,
        Key::Up => VK_UP,
        Key::Down => VK_DOWN,
        Key::Left => VK_LEFT,
        Key::Right => VK_RIGHT,
        Key::Home => VK_HOME,
        Key::End => VK_END,
        Key::PageUp => VK_PRIOR,
        Key::PageDown => VK_NEXT,
        Key::F1 => VK_F1,
        Key::F2 => VK_F2,
        Key::F3 => VK_F3,
        Key::F4 => VK_F4,
        Key::F5 => VK_F5,
        Key::F6 => VK_F6,
        Key::F7 => VK_F7,
        Key::F8 => VK_F8,
        Key::F9 => VK_F9,
        Key::F10 => VK_F10,
        Key::F11 => VK_F11,
        Key::F12 => VK_F12,
        Key::LeftControl => VK_LCONTROL,
        Key::RightControl => VK_RCONTROL,
        Key::LeftShift => VK_LSHIFT,
        Key::RightShift => VK_RSHIFT,
        Key::LeftAlt => VK_LMENU,
        Key::RightAlt => VK_RMENU,
        Key::LeftSuper => VK_LWIN,
        Key::RightSuper => VK_RWIN,
        Key::Letter(c) => match c.to_ascii_lowercase() {
            'a' => VK_A,
            'b' => VK_B,
            'c' => VK_C,
            'd' => VK_D,
            'e' => VK_E,
            'f' => VK_F,
            'g' => VK_G,
            'h' => VK_H,
            'i' => VK_I,
            'j' => VK_J,
            'k' => VK_K,
            'l' => VK_L,
            'm' => VK_M,
            'n' => VK_N,
            'o' => VK_O,
            'p' => VK_P,
            'q' => VK_Q,
            'r' => VK_R,
            's' => VK_S,
            't' => VK_T,
            'u' => VK_U,
            'v' => VK_V,
            'w' => VK_W,
            'x' => VK_X,
            'y' => VK_Y,
            'z' => VK_Z,
            other => VIRTUAL_KEY(other as u16),
        },
    }
}

#[cfg(windows)]
fn windows_key_input(vk: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

#[cfg(windows)]
fn send_windows_shortcut(keys: &[Key]) -> Result<()> {
    let mut inputs = Vec::with_capacity(keys.len() * 2);
    let modifiers = &keys[..keys.len() - 1];
    let key = windows_vk(keys[keys.len() - 1]);

    for modifier in modifiers {
        inputs.push(windows_key_input(windows_vk(*modifier), KEYBD_EVENT_FLAGS::default()));
    }
    inputs.push(windows_key_input(key, KEYBD_EVENT_FLAGS::default()));
    inputs.push(windows_key_input(key, KEYEVENTF_KEYUP));
    for modifier in modifiers.iter().rev() {
        inputs.push(windows_key_input(windows_vk(*modifier), KEYEVENTF_KEYUP));
    }

    let sent = unsafe { SendInput(&inputs, size_of::<INPUT>() as i32) };
    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        Err(SpotterError::Platform(format!(
            "keyboard_shortcut: SendInput sent {sent}/{} events: {}",
            inputs.len(),
            std::io::Error::last_os_error()
        )))
    }
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
    fn parse_lowercase_key_aliases() {
        assert_eq!(parse_key("enter").unwrap(), Key::Enter);
        assert_eq!(parse_key("ctrl").unwrap(), Key::LeftControl);
        assert_eq!(parse_key("esc").unwrap(), Key::Escape);
        assert_eq!(parse_key("v").unwrap(), Key::Letter('v'));
    }

    #[test]
    fn parse_digit_keys() {
        for digit in '0'..='9' {
            assert_eq!(parse_key(&digit.to_string()).unwrap(), Key::Digit(digit));
        }
    }

    #[test]
    fn parse_unknown_key_errors() {
        assert!(parse_key("NotARealKey").is_err());
        assert!(parse_key("10").is_err());
    }

    #[test]
    fn letters_map_to_physical_keys_for_shortcuts() {
        assert_eq!(parse_key("v").unwrap().to_enigo(), EnigoKey::V);
        assert_eq!(parse_key("A").unwrap().to_enigo(), EnigoKey::A);
    }
}
