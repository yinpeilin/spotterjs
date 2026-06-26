use crate::events::recorder::InputEvent;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hotkey {
    pub keys: Vec<String>,
}

#[derive(Debug, Default)]
pub struct HotkeyRegistry {
    hotkeys: HashMap<String, Hotkey>,
    pressed: HashSet<String>,
    fired: HashSet<String>,
}

impl HotkeyRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, id: impl Into<String>, keys: Vec<String>) {
        self.hotkeys.insert(
            id.into(),
            Hotkey {
                keys: normalize_keys(keys),
            },
        );
    }

    pub fn unregister(&mut self, id: &str) {
        self.hotkeys.remove(id);
        self.fired.remove(id);
    }

    pub fn handle_event(&mut self, event: &InputEvent) -> Vec<String> {
        let InputEvent::Key { key, pressed, .. } = event else {
            return Vec::new();
        };
        let key = normalize_key(key);
        if *pressed {
            self.pressed.insert(key);
        } else {
            self.pressed.remove(&key);
            self.fired.clear();
            return Vec::new();
        }

        let mut triggered = Vec::new();
        for (id, hotkey) in &self.hotkeys {
            if self.fired.contains(id) {
                continue;
            }
            if hotkey.keys.iter().all(|key| self.pressed.contains(key)) {
                self.fired.insert(id.clone());
                triggered.push(id.clone());
            }
        }
        triggered
    }
}

fn normalize_keys(keys: Vec<String>) -> Vec<String> {
    keys.into_iter().map(|key| normalize_key(&key)).collect()
}

fn normalize_key(key: &str) -> String {
    key.trim().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn triggers_once_until_a_key_is_released() {
        let mut registry = HotkeyRegistry::new();
        registry.register("save", vec!["Ctrl".into(), "S".into()]);

        assert!(registry
            .handle_event(&InputEvent::Key {
                key: "ctrl".into(),
                pressed: true,
                t_ms: 0
            })
            .is_empty());
        assert_eq!(
            registry.handle_event(&InputEvent::Key {
                key: "s".into(),
                pressed: true,
                t_ms: 1
            }),
            vec!["save".to_string()]
        );
        assert!(registry
            .handle_event(&InputEvent::Key {
                key: "S".into(),
                pressed: true,
                t_ms: 2
            })
            .is_empty());
        registry.handle_event(&InputEvent::Key {
            key: "S".into(),
            pressed: false,
            t_ms: 3,
        });
        assert_eq!(
            registry.handle_event(&InputEvent::Key {
                key: "S".into(),
                pressed: true,
                t_ms: 4
            }),
            vec!["save".to_string()]
        );
    }
}
