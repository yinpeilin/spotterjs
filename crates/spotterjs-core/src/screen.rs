use crate::error::Result;
use crate::platform::{platform, PlatformScreen};
use crate::types::Region;
use enigo::{Enigo, Mouse, Settings};

pub fn screen_width() -> Result<i32> {
    if let Ok(p) = platform() {
        if let Ok((w, _)) = p.screen_size() {
            return Ok(w);
        }
    }
    let enigo = Enigo::new(&Settings::default())
        .map_err(|e| crate::error::SpotterError::Platform(format!("enigo: {e}")))?;
    let (w, _) = enigo
        .main_display()
        .map_err(|e| crate::error::SpotterError::Platform(format!("main_display: {e}")))?;
    Ok(w)
}

pub fn screen_height() -> Result<i32> {
    if let Ok(p) = platform() {
        if let Ok((_, h)) = p.screen_size() {
            return Ok(h);
        }
    }
    let enigo = Enigo::new(&Settings::default())
        .map_err(|e| crate::error::SpotterError::Platform(format!("enigo: {e}")))?;
    let (_, h) = enigo
        .main_display()
        .map_err(|e| crate::error::SpotterError::Platform(format!("main_display: {e}")))?;
    Ok(h)
}

pub fn screen_size() -> Result<(i32, i32)> {
    Ok((screen_width()?, screen_height()?))
}

/// Returns the center point of a region (nut.js `centerOf`).
pub fn region_center(region: Region) -> (i32, i32) {
    region.center()
}

pub fn clamp_region_to_screen(region: Region) -> Result<Region> {
    let (sw, sh) = screen_size()?;
    Ok(region.clamp_to_screen(sw, sh))
}
