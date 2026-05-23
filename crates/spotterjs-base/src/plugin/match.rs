use crate::error::Result;
use crate::types::{MatchOptions, MatchResult, RgbaImage};

/// Template-matching backend (NCC; extensible via `MatchPlugin` trait).
pub trait MatchPlugin: Send + Sync {
    fn name(&self) -> &'static str;

    fn find(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<MatchResult>;

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<MatchResult>>;
}
