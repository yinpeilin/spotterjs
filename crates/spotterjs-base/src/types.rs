use serde::{Deserialize, Serialize};

/// Opaque window identifier (HWND on Windows, X11 Window on Linux).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WindowId(pub u64);

impl WindowId {
    pub fn as_u64(self) -> u64 {
        self.0
    }

    pub fn to_hex(self) -> String {
        format!("0x{:X}", self.0)
    }

    pub fn from_str(s: &str) -> Option<Self> {
        let s = s.trim();
        if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
            return u64::from_str_radix(hex, 16).ok().map(WindowId);
        }
        s.parse::<u64>().ok().map(WindowId)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Region {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct MatchResult {
    pub region: Region,
    pub score: f64,
}

impl MatchResult {
    pub fn new(region: Region, score: f64) -> Self {
        Self { region, score }
    }
}

impl Region {
    pub fn center(&self) -> (i32, i32) {
        (self.left + self.width / 2, self.top + self.height / 2)
    }

    pub fn clamp_to_screen(self, screen_w: i32, screen_h: i32) -> Self {
        let left = self.left.max(0);
        let top = self.top.max(0);
        let right = (self.left + self.width).min(screen_w);
        let bottom = (self.top + self.height).min(screen_h);
        Region {
            left,
            top,
            width: (right - left).max(0),
            height: (bottom - top).max(0),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone)]
pub struct RgbaImage {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy)]
pub struct MatchOptions {
    pub confidence: f64,
    pub search_region: Option<Region>,
    pub multi_scale: bool,
    pub scale_min: f64,
    pub scale_max: f64,
    pub scale_step: f64,
}

impl Default for MatchOptions {
    fn default() -> Self {
        Self {
            confidence: 0.9,
            search_region: None,
            multi_scale: false,
            scale_min: 0.8,
            scale_max: 1.2,
            scale_step: 0.1,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_region_to_screen_bounds() {
        let r = Region {
            left: -10,
            top: -5,
            width: 2000,
            height: 2000,
        };
        let c = r.clamp_to_screen(1920, 1080);
        assert_eq!(c.left, 0);
        assert_eq!(c.top, 0);
        assert_eq!(c.width, 1920);
        assert_eq!(c.height, 1080);
    }

    #[test]
    fn window_id_from_decimal_and_hex() {
        assert_eq!(WindowId::from_str("123").map(|w| w.0), Some(123));
        assert_eq!(WindowId::from_str("0x1A").map(|w| w.0), Some(26));
        assert_eq!(WindowId::from_str("0X1a").map(|w| w.0), Some(26));
        assert!(WindowId::from_str("not-a-id").is_none());
    }

    #[test]
    fn region_center_even_and_odd() {
        let even = Region {
            left: 0,
            top: 0,
            width: 10,
            height: 10,
        };
        assert_eq!(even.center(), (5, 5));

        let odd = Region {
            left: 0,
            top: 0,
            width: 11,
            height: 11,
        };
        assert_eq!(odd.center(), (5, 5));
    }
}
