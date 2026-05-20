//! Normalized cross-correlation template matching.

use spotter_base::{
    MatchOptions, MatchPlugin, Region, Result, RgbaImage, SpotterError,
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

    fn find(&self, haystack: &RgbaImage, needle: &RgbaImage, opts: &MatchOptions) -> Result<Region> {
        let needle_gray = rgba_to_gray(needle)?;
        let hay_gray = rgba_to_gray(haystack)?;
        find_in_gray(
            haystack,
            &hay_gray,
            &needle_gray,
            needle.width,
            needle.height,
            opts,
            None,
        )
    }

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<Region>> {
        let needle_gray = rgba_to_gray(needle)?;
        let hay_gray = rgba_to_gray(haystack)?;
        let mut blocked = vec![false; hay_gray.len()];
        let mut local_opts = *opts;
        local_opts.search_region = Some(Region {
            left: 0,
            top: 0,
            width: haystack.width as i32,
            height: haystack.height as i32,
        });

        let mut all = Vec::new();
        for _ in 0..10 {
            match find_in_gray(
                haystack,
                &hay_gray,
                &needle_gray,
                needle.width,
                needle.height,
                &local_opts,
                Some(&blocked),
            ) {
                Ok(region) => {
                    if all.iter().any(|r| regions_overlap(r, &region)) {
                        break;
                    }
                    mark_region_blocked(&mut blocked, haystack.width, &region);
                    all.push(region);
                }
                Err(SpotterError::MatchNotFound { .. }) => break,
                Err(e) => return Err(e),
            }
        }
        Ok(all)
    }
}

pub fn load_rgba_from_path(path: &std::path::Path) -> Result<RgbaImage> {
    let img = image::open(path).map_err(|e| SpotterError::Image(e.to_string()))?;
    let rgba = img.to_rgba8();
    Ok(RgbaImage {
        width: rgba.width(),
        height: rgba.height(),
        data: rgba.into_raw(),
    })
}

fn rgba_to_gray(img: &RgbaImage) -> Result<Vec<f32>> {
    if img.data.len() != (img.width * img.height * 4) as usize {
        return Err(SpotterError::Image("invalid RGBA buffer length".into()));
    }
    let mut gray = Vec::with_capacity((img.width * img.height) as usize);
    for chunk in img.data.chunks_exact(4) {
        let r = chunk[0] as f32;
        let g = chunk[1] as f32;
        let b = chunk[2] as f32;
        gray.push((0.299 * r + 0.587 * g + 0.114 * b) / 255.0);
    }
    Ok(gray)
}

fn mark_region_blocked(blocked: &mut [bool], hay_w: u32, region: &Region) {
    let x0 = region.left.max(0) as u32;
    let y0 = region.top.max(0) as u32;
    let x1 = (region.left + region.width) as u32;
    let y1 = (region.top + region.height) as u32;
    for y in y0..y1 {
        for x in x0..x1 {
            let idx = (y * hay_w + x) as usize;
            if idx < blocked.len() {
                blocked[idx] = true;
            }
        }
    }
}

fn window_blocked(blocked: &[bool], hay_w: u32, nw: u32, nh: u32, ox: u32, oy: u32) -> bool {
    for ty in 0..nh {
        for tx in 0..nw {
            let idx = ((oy + ty) * hay_w + (ox + tx)) as usize;
            if idx < blocked.len() && blocked[idx] {
                return true;
            }
        }
    }
    false
}

fn ncc_at(
    hay: &[f32],
    hay_w: u32,
    needle: &[f32],
    nw: u32,
    nh: u32,
    ox: u32,
    oy: u32,
) -> f64 {
    let n = (nw * nh) as f64;
    let mut sum_h = 0.0f64;
    let mut sum_n = 0.0f64;
    for ty in 0..nh {
        for tx in 0..nw {
            let hi = ((oy + ty) * hay_w + (ox + tx)) as usize;
            let ni = (ty * nw + tx) as usize;
            sum_h += hay[hi] as f64;
            sum_n += needle[ni] as f64;
        }
    }
    let mean_h = sum_h / n;
    let mean_n = sum_n / n;

    let mut cov = 0.0f64;
    let mut var_h = 0.0f64;
    let mut var_n = 0.0f64;
    for ty in 0..nh {
        for tx in 0..nw {
            let hi = ((oy + ty) * hay_w + (ox + tx)) as usize;
            let ni = (ty * nw + tx) as usize;
            let dh = hay[hi] as f64 - mean_h;
            let dn = needle[ni] as f64 - mean_n;
            cov += dh * dn;
            var_h += dh * dh;
            var_n += dn * dn;
        }
    }
    let denom = var_h.sqrt() * var_n.sqrt();
    if denom <= 1e-10 {
        if (mean_h - mean_n).abs() <= 1e-6 {
            return 1.0;
        }
        let mut max_diff = 0.0f64;
        for ty in 0..nh {
            for tx in 0..nw {
                let hi = ((oy + ty) * hay_w + (ox + tx)) as usize;
                let ni = (ty * nw + tx) as usize;
                max_diff = max_diff.max((hay[hi] as f64 - needle[ni] as f64).abs());
            }
        }
        return if max_diff <= 1e-6 { 1.0 } else { 0.0 };
    }
    cov / denom
}

fn find_in_gray(
    haystack: &RgbaImage,
    hay: &[f32],
    needle_gray: &[f32],
    nw: u32,
    nh: u32,
    opts: &MatchOptions,
    blocked: Option<&[bool]>,
) -> Result<Region> {
    const MAX_TEMPLATE_W: u32 = 512;
    const MAX_TEMPLATE_H: u32 = 128;
    if nw > MAX_TEMPLATE_W || nh > MAX_TEMPLATE_H {
        return Err(SpotterError::Plugin(format!(
            "NCC template too large (max {MAX_TEMPLATE_W}x{MAX_TEMPLATE_H})"
        )));
    }

    let hay_w = haystack.width;
    let hay_h = haystack.height;
    let search = opts.search_region.unwrap_or(Region {
        left: 0,
        top: 0,
        width: hay_w as i32,
        height: hay_h as i32,
    });

    let x0 = search.left.max(0) as u32;
    let y0 = search.top.max(0) as u32;
    let x1 = (search.left + search.width).min(hay_w as i32) as u32;
    let y1 = (search.top + search.height).min(hay_h as i32) as u32;

    if x1 < x0 + nw || y1 < y0 + nh {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    let mut best_score = f64::MIN;
    let mut best_xy = (0u32, 0u32);

    for oy in y0..=(y1 - nh) {
        for ox in x0..=(x1 - nw) {
            if blocked.is_some_and(|mask| window_blocked(mask, hay_w, nw, nh, ox, oy)) {
                continue;
            }
            let score = ncc_at(hay, hay_w, needle_gray, nw, nh, ox, oy);
            if score > best_score {
                best_score = score;
                best_xy = (ox, oy);
            }
        }
    }

    if best_score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    Ok(Region {
        left: best_xy.0 as i32,
        top: best_xy.1 as i32,
        width: nw as i32,
        height: nh as i32,
    })
}

fn regions_overlap(a: &Region, b: &Region) -> bool {
    let dx = (a.left - b.left).abs();
    let dy = (a.top - b.top).abs();
    dx < a.width / 2 && dy < a.height / 2
}

#[cfg(test)]
mod tests {
    use super::*;
    use spotter_base::MatchPlugin;

    fn solid_rgba(w: u32, h: u32, fill: [u8; 3]) -> RgbaImage {
        let mut data = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            data.extend_from_slice(&[fill[0], fill[1], fill[2], 255]);
        }
        RgbaImage { width: w, height: h, data }
    }

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
        let mut img = solid_rgba(hw, hh, bg);
        for y in 0..ph {
            for x in 0..pw {
                let idx = (((py + y) * hw + (px + x)) * 4) as usize;
                img.data[idx] = patch[0];
                img.data[idx + 1] = patch[1];
                img.data[idx + 2] = patch[2];
            }
        }
        img
    }

    fn needle_from_patch(
        hw: u32,
        px: u32,
        py: u32,
        pw: u32,
        ph: u32,
        hay: &RgbaImage,
    ) -> RgbaImage {
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

    fn default_opts(confidence: f64) -> MatchOptions {
        MatchOptions {
            confidence,
            search_region: None,
            multi_scale: false,
            scale_min: 0.8,
            scale_max: 1.2,
            scale_step: 0.1,
        }
    }

    #[test]
    fn regions_overlap_detects_near_duplicates() {
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
        assert!(regions_overlap(&a, &b));
    }

    #[test]
    fn regions_overlap_rejects_far_apart() {
        let a = Region {
            left: 10,
            top: 10,
            width: 20,
            height: 20,
        };
        let b = Region {
            left: 50,
            top: 50,
            width: 20,
            height: 20,
        };
        assert!(!regions_overlap(&a, &b));
    }

    #[test]
    fn find_locates_exact_patch() {
        let hay = haystack_with_patch(64, 64, 10, 15, 8, 8, [40, 40, 40], [240, 20, 20]);
        let needle = needle_from_patch(64, 10, 15, 8, 8, &hay);
        let matcher = NccMatcher;
        let found = matcher
            .find(&hay, &needle, &default_opts(0.5))
            .expect("patch should match");
        assert_eq!(found.left, 10);
        assert_eq!(found.top, 15);
        assert_eq!(found.width, 8);
        assert_eq!(found.height, 8);
    }

    #[test]
    fn find_respects_search_region() {
        let mut hay = haystack_with_patch(64, 64, 5, 5, 8, 8, [30, 30, 30], [200, 50, 50]);
        paint_patch(&mut hay, 64, 40, 40, 8, 8, [200, 50, 50]);
        let needle = needle_from_patch(64, 5, 5, 8, 8, &hay);
        let matcher = NccMatcher;
        let mut opts = default_opts(0.5);
        opts.search_region = Some(Region {
            left: 0,
            top: 0,
            width: 24,
            height: 24,
        });
        let found = matcher.find(&hay, &needle, &opts).expect("left patch only");
        assert_eq!(found.left, 5);
        assert_eq!(found.top, 5);
    }

    #[test]
    fn find_fails_below_confidence() {
        let hay = haystack_with_patch(32, 32, 4, 4, 6, 6, [50, 50, 50], [220, 10, 10]);
        let needle = needle_from_patch(32, 4, 4, 6, 6, &hay);
        let matcher = NccMatcher;
        let err = matcher
            .find(&hay, &needle, &default_opts(1.1))
            .expect_err("impossible confidence");
        assert!(matches!(err, SpotterError::MatchNotFound { .. }));
    }

    #[test]
    fn find_all_returns_two_distinct() {
        let mut hay = solid_rgba(64, 64, [20, 20, 20]);
        paint_patch(&mut hay, 64, 6, 6, 8, 8, [250, 0, 0]);
        paint_patch(&mut hay, 64, 44, 44, 8, 8, [250, 0, 0]);
        let needle = needle_from_patch(64, 6, 6, 8, 8, &hay);
        let matcher = NccMatcher;
        let all = matcher
            .find_all(&hay, &needle, &default_opts(0.5))
            .expect("two patches");
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn find_all_masks_duplicates() {
        let mut hay = solid_rgba(64, 64, [25, 25, 25]);
        paint_patch(&mut hay, 64, 10, 10, 8, 8, [255, 0, 0]);
        paint_patch(&mut hay, 64, 12, 12, 8, 8, [255, 0, 0]);
        let needle = needle_from_patch(64, 10, 10, 8, 8, &hay);
        let matcher = NccMatcher;
        let all = matcher
            .find_all(&hay, &needle, &default_opts(0.5))
            .expect("overlapping patches");
        assert_eq!(all.len(), 1);
    }

    fn paint_patch(hay: &mut RgbaImage, hw: u32, px: u32, py: u32, pw: u32, ph: u32, patch: [u8; 3]) {
        for y in 0..ph {
            for x in 0..pw {
                let idx = (((py + y) * hw + (px + x)) * 4) as usize;
                hay.data[idx] = patch[0];
                hay.data[idx + 1] = patch[1];
                hay.data[idx + 2] = patch[2];
            }
        }
    }
}
