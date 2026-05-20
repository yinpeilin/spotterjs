//! Re-exports shared types from `spotter-base` plus core-only types.

pub use spotter_base::{MatchOptions, Point, Region, RgbaImage, WindowId};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: WindowId,
    pub title: String,
    pub region: Region,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}
