use crate::error::Result;
use crate::types::{MatchOptions, Region, RgbaImage};

/// Template-matching backend (NCC, OpenCV, etc.).
pub trait MatchPlugin: Send + Sync {
    fn name(&self) -> &'static str;

    fn find(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Region>;

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<Region>>;
}
