//! Re-exports shared types from `spotter-base` plus core-only types.

pub use spotter_base::{MatchOptions, Point, Region, RgbaImage, WindowId};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: WindowId,
    pub title: String,
    pub region: Region,
    pub process_id: u32,
    pub process_name: String,
    pub exe_path: Option<String>,
    pub is_minimized: bool,
    pub is_foreground: bool,
}

/// Desktop application aggregated from one or more top-level windows (same PID).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopApp {
    pub process_id: u32,
    pub process_name: String,
    pub exe_path: Option<String>,
    pub windows: Vec<WindowInfo>,
    pub is_foreground: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}
