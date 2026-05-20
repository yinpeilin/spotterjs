use crate::capture::{capture_screen, capture_window};
use crate::input::tap_at;
use crate::types::MouseButton;
use spotter_base::{MatchOptions, MatchPlugin, Region, Result, RgbaImage, SpotterError, WindowId};
use spotter_plugin_match_ncc::{load_rgba_from_path, NccMatcher};
use std::path::Path;
use std::thread;
use std::time::{Duration, Instant};

static NCC: NccMatcher = NccMatcher;

fn resolve_needle(path: &Path) -> Result<RgbaImage> {
    load_rgba_from_path(path)
}

pub fn find_template_in_haystack(
    haystack: &RgbaImage,
    needle_path: &Path,
    opts: &MatchOptions,
) -> Result<Region> {
    let needle = resolve_needle(needle_path)?;
    find_template_in_haystack_rgba(haystack, &needle, opts)
}

/// Match a template already loaded in memory (used by tests and advanced callers).
pub fn find_template_in_haystack_rgba(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<Region> {
    NCC.find(haystack, needle, opts)
}

/// Apply screen-space offset after matching in a cropped haystack (same as `find_template`).
pub fn translate_region(mut region: Region, offset_x: i32, offset_y: i32) -> Region {
    region.left += offset_x;
    region.top += offset_y;
    region
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

pub fn find_template(path: &Path, opts: MatchOptions) -> Result<Region> {
    let (hay, offset_x, offset_y) = if let Some(r) = opts.search_region {
        (capture_screen(Some(r))?, r.left, r.top)
    } else {
        (capture_screen(None)?, 0, 0)
    };
    let mut local_opts = opts;
    local_opts.search_region = Some(Region {
        left: 0,
        top: 0,
        width: hay.width as i32,
        height: hay.height as i32,
    });
    let needle = resolve_needle(path)?;
    let found = NCC.find(&hay, &needle, &local_opts)?;
    Ok(translate_region(found, offset_x, offset_y))
}

pub fn find_all_templates(path: &Path, opts: MatchOptions) -> Result<Vec<Region>> {
    let (hay, offset_x, offset_y) = if let Some(r) = opts.search_region {
        (capture_screen(Some(r))?, r.left, r.top)
    } else {
        (capture_screen(None)?, 0, 0)
    };
    let needle = resolve_needle(path)?;
    let regions = NCC.find_all(&hay, &needle, &opts)?;
    Ok(regions
        .into_iter()
        .map(|r| translate_region(r, offset_x, offset_y))
        .collect())
}

pub fn wait_for_template(
    path: &Path,
    timeout_ms: u64,
    opts: MatchOptions,
    interval_ms: Option<u64>,
) -> Result<Region> {
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

pub fn tap_template(path: &Path, opts: MatchOptions) -> Result<()> {
    let region = find_template(path, opts)?;
    let (cx, cy) = region.center();
    tap_at(cx, cy, MouseButton::Left)
}

fn window_match_origin(window_id: WindowId) -> Result<(i32, i32)> {
    crate::window::get_window_client_origin(window_id)
}

pub fn find_template_in_window(
    window_id: WindowId,
    path: &Path,
    mut opts: MatchOptions,
) -> Result<Region> {
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
    let needle = resolve_needle(path)?;
    let found = NCC.find(&hay, &needle, &opts)?;
    Ok(translate_region(found, ox, oy))
}

pub fn find_all_templates_in_window(
    window_id: WindowId,
    path: &Path,
    mut opts: MatchOptions,
) -> Result<Vec<Region>> {
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
    let needle = resolve_needle(path)?;
    let regions = NCC.find_all(&hay, &needle, &opts)?;
    Ok(regions
        .into_iter()
        .map(|r| translate_region(r, ox, oy))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use spotter_base::MatchPlugin;
    use spotter_plugin_match_ncc::NccMatcher;

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
        let global = translate_region(local, 100, 50);
        assert_eq!(global.left, 108);
        assert_eq!(global.top, 62);
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
