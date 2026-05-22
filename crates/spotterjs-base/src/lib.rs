//! Shared foundation for Spotter native crates and algorithm plugins.

pub mod error;
pub mod plugin;
pub mod types;

#[cfg(feature = "napi")]
pub mod napi;

pub use error::{Result, SpotterError};
pub use plugin::{MatchPlugin, OcrPlugin};
pub use types::{
    MatchOptions, Point, Region, RgbaImage, WindowId,
};
