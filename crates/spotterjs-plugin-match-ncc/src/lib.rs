//! Normalized cross-correlation template matching (NCC v2).

mod gray;
mod integral;
mod multiscale;
mod ncc;
mod parallel;
mod pyramid;
mod simd;
mod util;

use spotterjs_base::{MatchOptions, MatchPlugin, MatchResult, Result, RgbaImage};

pub use gray::rgba_to_gray;
pub use multiscale::{find_all_with_multiscale, find_with_multiscale};
pub use ncc::{
    check_template_size, find_best, find_best_serial, find_single, prepare_needle, MAX_TEMPLATE_DIM,
};

pub struct NccMatcher;

impl Default for NccMatcher {
    fn default() -> Self {
        Self
    }
}

impl MatchPlugin for NccMatcher {
    fn name(&self) -> &'static str {
        "ncc"
    }

    fn find(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<MatchResult> {
        find_with_multiscale(haystack, needle, opts)
    }

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<MatchResult>> {
        find_all_with_multiscale(haystack, needle, opts)
    }
}

#[cfg(test)]
mod tests {
    use super::util;
    use spotterjs_base::Region;

    #[test]
    fn util_regions_overlap() {
        let a = Region {
            left: 10,
            top: 10,
            width: 20,
            height: 20,
        };
        let b = Region {
            left: 12,
            top: 12,
            width: 20,
            height: 20,
        };
        assert!(util::regions_overlap(&a, &b));
    }
}
