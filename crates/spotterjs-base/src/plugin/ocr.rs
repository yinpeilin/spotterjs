use crate::error::Result;
use crate::types::{Region, RgbaImage};

/// OCR backend placeholder for phase C (`@spotterjs/plugin-ocr`).
pub trait OcrPlugin: Send + Sync {
    fn name(&self) -> &'static str;

    fn find_text(&self, _haystack: &RgbaImage, _text: &str) -> Result<Region> {
        Err(crate::error::SpotterError::Plugin(
            "OCR plugin not implemented".into(),
        ))
    }

    fn read(&self, _haystack: &RgbaImage) -> Result<String> {
        Err(crate::error::SpotterError::Plugin(
            "OCR plugin not implemented".into(),
        ))
    }
}
