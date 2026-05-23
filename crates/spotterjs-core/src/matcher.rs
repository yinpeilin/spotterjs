//! Template match orchestration — capture, search regions, window coords.
//! Backend: `spotterjs-plugin-match-ncc` (NCC only).

use crate::capture::{capture_screen, capture_window};
use crate::image::load_rgba_from_bytes;
use crate::needle_cache::load_needle_cached;
use spotterjs_base::{
    MatchOptions, MatchPlugin, MatchResult, Region, Result, RgbaImage, SpotterError, WindowId,
};
use spotterjs_plugin_match_ncc::NccMatcher;
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

static NCC: NccMatcher = NccMatcher;

fn resolve_needle(path: &Path) -> Result<RgbaImage> {
    load_needle_cached(path)
}

fn resolve_needle_optional(path: &Path, bytes: Option<&[u8]>) -> Result<RgbaImage> {
    if let Some(b) = bytes {
        return load_rgba_from_bytes(b);
    }
    if path.as_os_str().is_empty() {
        return Err(SpotterError::Image(
            "needle path empty and no needle buffer provided".into(),
        ));
    }
    load_needle_cached(path)
}

fn capture_haystack_for_match(opts: &MatchOptions) -> Result<(RgbaImage, i32, i32, MatchOptions)> {
    let mut local_opts = *opts;
    let (hay, offset_x, offset_y) = if let Some(r) = opts.search_region {
        (capture_screen(Some(r))?, r.left, r.top)
    } else {
        (capture_screen(None)?, 0, 0)
    };
    local_opts.search_region = Some(Region {
        left: 0,
        top: 0,
        width: hay.width as i32,
        height: hay.height as i32,
    });
    Ok((hay, offset_x, offset_y, local_opts))
}

pub fn find_template_in_haystack(
    haystack: &RgbaImage,
    needle_path: &Path,
    opts: &MatchOptions,
) -> Result<MatchResult> {
    let needle = resolve_needle(needle_path)?;
    find_template_in_haystack_rgba(haystack, &needle, opts)
}

/// Match a template already loaded in memory (used by tests and advanced callers).
pub fn find_template_in_haystack_rgba(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<MatchResult> {
    NCC.find(haystack, needle, opts)
}

/// Alias for in-memory haystack + needle matching.
pub fn find_template_buffers(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<MatchResult> {
    find_template_in_haystack_rgba(haystack, needle, opts)
}

pub fn find_all_template_buffers(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<Vec<MatchResult>> {
    NCC.find_all(haystack, needle, opts)
}

pub fn find_template_from_bytes(needle_bytes: &[u8], opts: MatchOptions) -> Result<MatchResult> {
    find_template_with_needle(Path::new(""), Some(needle_bytes), opts)
}

pub fn find_template_with_needle(
    path: &Path,
    needle_bytes: Option<&[u8]>,
    opts: MatchOptions,
) -> Result<MatchResult> {
    let (hay, offset_x, offset_y, local_opts) = capture_haystack_for_match(&opts)?;
    let needle = resolve_needle_optional(path, needle_bytes)?;
    let found = NCC.find(&hay, &needle, &local_opts)?;
    Ok(translate_match_result(found, offset_x, offset_y))
}

pub fn find_all_templates_with_needle(
    path: &Path,
    needle_bytes: Option<&[u8]>,
    opts: MatchOptions,
) -> Result<Vec<MatchResult>> {
    let (hay, offset_x, offset_y, local_opts) = capture_haystack_for_match(&opts)?;
    let needle = resolve_needle_optional(path, needle_bytes)?;
    let matches = NCC.find_all(&hay, &needle, &local_opts)?;
    Ok(matches
        .into_iter()
        .map(|m| translate_match_result(m, offset_x, offset_y))
        .collect())
}

pub fn wait_for_template_with_needle(
    path: &Path,
    needle_bytes: Option<&[u8]>,
    timeout_ms: u64,
    opts: MatchOptions,
    interval_ms: Option<u64>,
) -> Result<MatchResult> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(interval_ms.unwrap_or(200));
    loop {
        match find_template_with_needle(path, needle_bytes, opts) {
            Ok(r) => return Ok(r),
            Err(SpotterError::MatchNotFound { .. }) => {
                if Instant::now() >= deadline {
                    return Err(SpotterError::MatchTimeout { timeout_ms });
                }
                thread::sleep(interval);
            }
            Err(e) => return Err(e),
        }
    }
}

pub fn wait_for_template_buffers(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    timeout_ms: u64,
    opts: MatchOptions,
    interval_ms: Option<u64>,
) -> Result<MatchResult> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(interval_ms.unwrap_or(200));
    loop {
        match NCC.find(haystack, needle, &opts) {
            Ok(r) => return Ok(r),
            Err(SpotterError::MatchNotFound { .. }) => {
                if Instant::now() >= deadline {
                    return Err(SpotterError::MatchTimeout { timeout_ms });
                }
                thread::sleep(interval);
            }
            Err(e) => return Err(e),
        }
    }
}

/// Apply screen-space offset after matching in a cropped haystack (same as `find_template`).
pub fn translate_region(mut region: Region, offset_x: i32, offset_y: i32) -> Region {
    region.left += offset_x;
    region.top += offset_y;
    region
}

pub fn translate_match_result(mut found: MatchResult, offset_x: i32, offset_y: i32) -> MatchResult {
    found.region = translate_region(found.region, offset_x, offset_y);
    found
}

fn intersect_region(a: Region, b: Region) -> Option<Region> {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = (a.left + a.width).min(b.left + b.width);
    let bottom = (a.top + a.height).min(b.top + b.height);
    let width = right - left;
    let height = bottom - top;
    if width <= 0 || height <= 0 {
        return None;
    }
    Some(Region {
        left,
        top,
        width,
        height,
    })
}

pub fn find_template(path: &Path, opts: MatchOptions) -> Result<MatchResult> {
    find_template_with_needle(path, None, opts)
}

pub fn find_all_templates(path: &Path, opts: MatchOptions) -> Result<Vec<MatchResult>> {
    find_all_templates_with_needle(path, None, opts)
}

pub fn wait_for_template(
    path: &Path,
    timeout_ms: u64,
    opts: MatchOptions,
    interval_ms: Option<u64>,
) -> Result<MatchResult> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(interval_ms.unwrap_or(200));
    loop {
        match find_template(path, opts) {
            Ok(r) => return Ok(r),
            Err(SpotterError::MatchNotFound { .. }) => {
                if Instant::now() >= deadline {
                    return Err(SpotterError::MatchTimeout { timeout_ms });
                }
                thread::sleep(interval);
            }
            Err(e) => return Err(e),
        }
    }
}

/// Screen origin of the window capture frame (`capture_window` uses the outer window rect).
fn window_match_origin(window_id: WindowId) -> Result<(i32, i32)> {
    let region = crate::window::get_window_region(window_id)?;
    Ok((region.left, region.top))
}

fn window_haystack_and_opts(
    window_id: WindowId,
    mut opts: MatchOptions,
) -> Result<(RgbaImage, MatchOptions, i32, i32)> {
    let hay = capture_window(window_id)?;
    let (ox, oy) = window_match_origin(window_id)?;
    let full_window = Region {
        left: 0,
        top: 0,
        width: hay.width as i32,
        height: hay.height as i32,
    };
    opts.search_region = Some(
        opts.search_region
            .and_then(|r| intersect_region(r, full_window))
            .unwrap_or(full_window),
    );
    Ok((hay, opts, ox, oy))
}

pub fn find_template_in_window(
    window_id: WindowId,
    path: &Path,
    opts: MatchOptions,
) -> Result<MatchResult> {
    find_template_in_window_with_needle(window_id, path, None, opts)
}

pub fn find_template_in_window_with_needle(
    window_id: WindowId,
    path: &Path,
    needle_bytes: Option<&[u8]>,
    opts: MatchOptions,
) -> Result<MatchResult> {
    let (hay, local_opts, ox, oy) = window_haystack_and_opts(window_id, opts)?;
    let needle = resolve_needle_optional(path, needle_bytes)?;
    let found = NCC.find(&hay, &needle, &local_opts)?;
    Ok(translate_match_result(found, ox, oy))
}

pub fn find_all_templates_in_window(
    window_id: WindowId,
    path: &Path,
    opts: MatchOptions,
) -> Result<Vec<MatchResult>> {
    find_all_templates_in_window_with_needle(window_id, path, None, opts)
}

pub fn find_all_templates_in_window_with_needle(
    window_id: WindowId,
    path: &Path,
    needle_bytes: Option<&[u8]>,
    opts: MatchOptions,
) -> Result<Vec<MatchResult>> {
    let (hay, local_opts, ox, oy) = window_haystack_and_opts(window_id, opts)?;
    let needle = resolve_needle_optional(path, needle_bytes)?;
    let matches = NCC.find_all(&hay, &needle, &local_opts)?;
    Ok(matches
        .into_iter()
        .map(|m| translate_match_result(m, ox, oy))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use spotterjs_base::MatchPlugin;
    use spotterjs_plugin_match_ncc::NccMatcher;

    fn haystack_with_patch(
        hw: u32,
        hh: u32,
        px: u32,
        py: u32,
        pw: u32,
        ph: u32,
        bg: [u8; 3],
        patch: [u8; 3],
    ) -> RgbaImage {
        let mut data = Vec::with_capacity((hw * hh * 4) as usize);
        for _ in 0..(hw * hh) {
            data.extend_from_slice(&[bg[0], bg[1], bg[2], 255]);
        }
        for y in 0..ph {
            for x in 0..pw {
                let idx = (((py + y) * hw + (px + x)) * 4) as usize;
                data[idx] = patch[0];
                data[idx + 1] = patch[1];
                data[idx + 2] = patch[2];
            }
        }
        RgbaImage {
            width: hw,
            height: hh,
            data,
        }
    }

    fn needle_from_hay(hay: &RgbaImage, hw: u32, px: u32, py: u32, pw: u32, ph: u32) -> RgbaImage {
        let mut data = Vec::with_capacity((pw * ph * 4) as usize);
        for y in 0..ph {
            for x in 0..pw {
                let idx = (((py + y) * hw + (px + x)) * 4) as usize;
                data.extend_from_slice(&hay.data[idx..idx + 4]);
            }
        }
        RgbaImage {
            width: pw,
            height: ph,
            data,
        }
    }

    #[test]
    fn search_region_offset_applied() {
        let hay = haystack_with_patch(48, 48, 8, 12, 6, 6, [35, 35, 35], [255, 128, 0]);
        let needle = needle_from_hay(&hay, 48, 8, 12, 6, 6);
        let matcher = NccMatcher;
        let mut opts = MatchOptions::default();
        opts.confidence = 0.5;
        let local = matcher.find(&hay, &needle, &opts).unwrap();
        let global = translate_match_result(local, 100, 50);
        assert_eq!(global.region.left, 108);
        assert_eq!(global.region.top, 62);
        assert!(global.score >= opts.confidence);
    }

    #[test]
    fn intersect_region_clips_to_bounds() {
        let a = Region {
            left: 10,
            top: 20,
            width: 100,
            height: 80,
        };
        let b = Region {
            left: 0,
            top: 0,
            width: 50,
            height: 200,
        };
        let i = intersect_region(a, b).unwrap();
        assert_eq!(i.left, 10);
        assert_eq!(i.top, 20);
        assert_eq!(i.width, 40);
        assert_eq!(i.height, 80);
        assert!(intersect_region(
            Region {
                left: 100,
                top: 0,
                width: 10,
                height: 10
            },
            b
        )
        .is_none());
    }

    #[test]
    fn find_all_with_search_region_uses_local_coords() {
        let hay = haystack_with_patch(64, 64, 20, 20, 8, 8, [30, 30, 30], [200, 50, 50]);
        let needle = needle_from_hay(&hay, 64, 20, 20, 8, 8);
        let matcher = NccMatcher;
        let mut opts = MatchOptions::default();
        opts.confidence = 0.5;
        opts.search_region = Some(Region {
            left: 0,
            top: 0,
            width: 64,
            height: 64,
        });
        let local = matcher
            .find_all(&hay, &needle, &opts)
            .expect("find_all in hay");
        assert_eq!(local.len(), 1);
        assert_eq!(local[0].region.left, 20);
        assert_eq!(local[0].region.top, 20);
        let global = translate_match_result(local[0], 100, 50);
        assert_eq!(global.region.left, 120);
        assert_eq!(global.region.top, 70);
        assert!(global.score >= opts.confidence);
    }

    #[test]
    fn translate_region_adds_offsets() {
        let r = Region {
            left: 1,
            top: 2,
            width: 3,
            height: 4,
        };
        let t = translate_region(r, 10, 20);
        assert_eq!(t.left, 11);
        assert_eq!(t.top, 22);
    }
}
