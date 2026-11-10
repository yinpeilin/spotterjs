//! Verified physical-key plans for literal ASCII text.
//!
//! Keep every event in SendInput's queue. Synchronous window messages can
//! overtake earlier clicks/shortcuts and are not an input-completion barrier.

use std::sync::OnceLock;
use windows::Wdk::System::SystemServices::RtlGetVersion;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::SystemInformation::OSVERSIONINFOW;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetKeyState, GetKeyboardLayout, MapVirtualKeyExW, ToUnicodeEx, VkKeyScanExW,
    HKL, MAPVK_VK_TO_VSC_EX, VIRTUAL_KEY, VK_CAPITAL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN,
    VK_RCONTROL, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AsciiKey {
    pub virtual_key: VIRTUAL_KEY,
    pub scan: u16,
    pub extended: bool,
    pub shift: bool,
}

pub(crate) struct AsciiLayout {
    layout: HKL,
    caps_lock: bool,
    foreground: HWND,
    held_virtual_keys: [bool; 256],
}

fn stateless_translation_supported(major: u32, build: u32) -> bool {
    major > 10 || (major == 10 && build >= 14_393)
}

fn can_translate_without_state_change() -> bool {
    static SUPPORTED: OnceLock<bool> = OnceLock::new();
    *SUPPORTED.get_or_init(|| unsafe {
        let mut version = OSVERSIONINFOW {
            dwOSVersionInfoSize: std::mem::size_of::<OSVERSIONINFOW>() as u32,
            ..Default::default()
        };
        RtlGetVersion(&mut version).0 >= 0
            && stateless_translation_supported(version.dwMajorVersion, version.dwBuildNumber)
    })
}

fn mapping_parts(mapping: i16) -> Option<(VIRTUAL_KEY, bool)> {
    if mapping == -1 {
        return None;
    }
    let modifiers = ((mapping as u16) >> 8) as u8;
    if modifiers > 1 {
        // Ctrl/Alt/AltGr mappings would become shortcuts, not literal typing.
        return None;
    }
    let key = mapping as u16 & 0xff;
    (key != 0).then_some((VIRTUAL_KEY(key), modifiers == 1))
}

fn standard_us_layout(layout: HKL) -> bool {
    // Only the standard US table is known to have no dead-key composition.
    // The low language word alone also matches US-International and is unsafe.
    layout.0 as usize as u32 == 0x0409_0409
}

impl AsciiLayout {
    /// Snapshot before sending any events, so earlier characters in this
    /// write cannot be mistaken for keys held by the caller.
    pub(crate) fn capture(text: &str) -> Option<Self> {
        if !can_translate_without_state_change() {
            return None;
        }
        unsafe {
            let foreground = GetForegroundWindow();
            if foreground.0.is_null() {
                return None;
            }
            let thread_id = GetWindowThreadProcessId(foreground, None);
            if thread_id == 0 {
                return None;
            }
            let layout = GetKeyboardLayout(thread_id);
            // Legacy ImmIsIME can flag even the canonical US table under
            // modern TSF. Restrict by the exact layout identity instead; all
            // other layouts keep Unicode input and cannot start composition.
            if !standard_us_layout(layout) {
                return None;
            }
            if [
                VK_LSHIFT,
                VK_RSHIFT,
                VK_LCONTROL,
                VK_RCONTROL,
                VK_LMENU,
                VK_RMENU,
                VK_LWIN,
                VK_RWIN,
            ]
            .iter()
            .any(|key| GetAsyncKeyState(key.0 as i32) < 0)
            {
                return None;
            }
            let mut held_virtual_keys = [false; 256];
            let mut seen = [false; 128];
            for byte in text
                .bytes()
                .filter(|byte| byte.is_ascii_graphic() || *byte == b' ')
            {
                if std::mem::replace(&mut seen[byte as usize], true) {
                    continue;
                }
                if let Some((key, _)) = mapping_parts(VkKeyScanExW(u16::from(byte), layout)) {
                    held_virtual_keys[key.0 as usize] |= GetAsyncKeyState(key.0 as i32) < 0;
                }
            }
            Some(Self {
                layout,
                // GetKeyboardState can cache a worker thread's old toggle
                // state. Query this key explicitly for each write instead.
                caps_lock: GetKeyState(VK_CAPITAL.0 as i32) & 1 != 0,
                foreground,
                held_virtual_keys,
            })
        }
    }

    pub(crate) fn key(&self, character: char) -> Option<AsciiKey> {
        if !character.is_ascii_graphic() && character != ' ' {
            return None;
        }
        if !self.foreground.0.is_null() {
            unsafe {
                let foreground = GetForegroundWindow();
                if foreground != self.foreground {
                    return None;
                }
                let thread_id = GetWindowThreadProcessId(foreground, None);
                if thread_id == 0 || GetKeyboardLayout(thread_id) != self.layout {
                    return None;
                }
            }
        }
        let (virtual_key, suggested_shift) =
            mapping_parts(unsafe { VkKeyScanExW(character as u16, self.layout) })?;
        // The physical batch would release this key even if the caller
        // already held it through keyboard.down().
        if self.held_virtual_keys[virtual_key.0 as usize] {
            return None;
        }
        let scan = unsafe {
            MapVirtualKeyExW(virtual_key.0 as u32, MAPVK_VK_TO_VSC_EX, Some(self.layout))
        };
        if scan == 0 || scan & 0xff00 == 0xe100 {
            return None;
        }
        for shift in [suggested_shift, !suggested_shift] {
            let mut state = [0u8; 256];
            state[VK_CAPITAL.0 as usize] = u8::from(self.caps_lock);
            if shift {
                state[VK_SHIFT.0 as usize] = 0x80;
                state[VK_LSHIFT.0 as usize] = 0x80;
            }
            let mut output = [0u16; 8];
            // Flag 4 is supported only on Windows 10 1607+. It avoids changing
            // the user's dead-key buffer while checking this exact mapping.
            let count = unsafe {
                ToUnicodeEx(
                    virtual_key.0 as u32,
                    scan,
                    &state,
                    &mut output,
                    4,
                    Some(self.layout),
                )
            };
            if count == 1 && output[0] == character as u16 {
                return Some(AsciiKey {
                    virtual_key,
                    scan: (scan & 0xff) as u16,
                    extended: scan & 0xff00 == 0xe000,
                    shift,
                });
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::core::w;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        LoadKeyboardLayoutW, ACTIVATE_KEYBOARD_LAYOUT_FLAGS, VK_A,
    };

    #[test]
    fn refuses_unsafe_modifiers_and_unmapped_characters() {
        assert_eq!(mapping_parts(-1), None);
        assert_eq!(mapping_parts(0), None);
        for modifiers in [2, 3, 4, 6, 8, 0xff] {
            assert_eq!(mapping_parts((modifiers << 8 | 0x41) as i16), None);
        }
        assert_eq!(mapping_parts(0x41), Some((VK_A, false)));
        assert_eq!(mapping_parts(0x141), Some((VK_A, true)));
    }

    #[test]
    fn requires_the_no_state_change_translation_flag() {
        assert!(!stateless_translation_supported(6, 7601));
        assert!(!stateless_translation_supported(10, 10_240));
        assert!(stateless_translation_supported(10, 14_393));
        assert!(stateless_translation_supported(10, 26_100));
    }

    #[test]
    fn limits_physical_typing_to_the_standard_non_dead_us_layout() {
        let layout = |value| HKL(value as *mut _);
        assert!(standard_us_layout(layout(0x0409_0409usize)));
        for value in [0, 0xF001_0409, 0x0002_0409, 0x0809_0809, 0x0804_0804] {
            assert!(!standard_us_layout(layout(value)), "{value:#x}");
        }
    }

    fn test_us_layout() -> HKL {
        // Flags 0 loads the table without activating it on this or another
        // thread. The synthetic states never toggle the real CapsLock key.
        unsafe {
            LoadKeyboardLayoutW(w!("00000409"), ACTIVATE_KEYBOARD_LAYOUT_FLAGS::default())
                .expect("US keyboard layout")
        }
    }

    #[test]
    fn falls_back_for_both_cases_of_a_held_letter() {
        if !can_translate_without_state_change() {
            return;
        }
        let mut held_virtual_keys = [false; 256];
        held_virtual_keys[VK_A.0 as usize] = true;
        let context = AsciiLayout {
            layout: test_us_layout(),
            caps_lock: false,
            foreground: HWND::default(),
            held_virtual_keys,
        };
        assert!(context.key('a').is_none());
        assert!(context.key('A').is_none());
        assert!(context.key('b').is_some());
    }

    #[test]
    fn verifies_us_ascii_with_caps_lock_without_activating_or_typing() {
        if !can_translate_without_state_change() {
            return;
        }
        let layout = test_us_layout();
        for caps_lock in [false, true] {
            let context = AsciiLayout {
                layout,
                caps_lock,
                foreground: HWND::default(),
                held_virtual_keys: [false; 256],
            };
            for character in ' '..='~' {
                let key = context.key(character).expect("printable US ASCII mapping");
                assert_ne!(key.scan, 0);
                if character == 'a' {
                    assert_eq!(key.virtual_key, VK_A);
                    assert_eq!(key.shift, caps_lock);
                }
                if character == 'A' {
                    assert_eq!(key.virtual_key, VK_A);
                    assert_ne!(key.shift, caps_lock);
                }
                if character == '!' {
                    assert!(key.shift);
                }
            }
            for character in ['\t', '\n', '中', '😀'] {
                assert!(context.key(character).is_none());
            }
        }
    }
}
