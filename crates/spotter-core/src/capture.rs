use crate::error::Result;
use crate::platform::{platform, PlatformCapture};
use crate::types::{Region, RgbaImage, WindowId};

pub fn capture_screen(region: Option<Region>) -> Result<RgbaImage> {
    platform()?.capture_screen(region)
}

pub fn capture_window(id: WindowId) -> Result<RgbaImage> {
    platform()?.capture_window(id)
}
