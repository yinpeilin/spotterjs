//! Feature-based template matching plugin for spotterjs.

mod akaze_backend;
mod gray;

use spotterjs_base::{MatchOptions, MatchPlugin, MatchResult, Result, RgbaImage};

pub struct FeatureMatcher;

impl Default for FeatureMatcher {
    fn default() -> Self {
        Self
    }
}

impl MatchPlugin for FeatureMatcher {
    fn name(&self) -> &'static str {
        "feature"
    }

    fn find(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<MatchResult> {
        akaze_backend::find(haystack, needle, opts)
    }

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<MatchResult>> {
        akaze_backend::find_all(haystack, needle, opts)
    }
}
