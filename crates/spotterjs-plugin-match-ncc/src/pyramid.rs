//! Coarse-to-fine pyramid search for single-scale `find`.

use spotterjs_base::{MatchOptions, Region, Result, RgbaImage};

use crate::gray::resize_gray;
use crate::ncc::{find_best, find_single, find_top_k, prepare_needle, PreparedNeedle};

const COARSE_SCALE: f64 = 0.5;
const TOP_K: usize = 3;
const ROI_PAD_MULT: u32 = 2;
pub const PYRAMID_MIN_HAY_DIM: u32 = 256;
const PYRAMID_MIN_WIDTH: u32 = 1920;
const PYRAMID_MIN_HEIGHT: u32 = 1080;

fn dims_haystack(w: u32, h: u32) -> RgbaImage {
    RgbaImage {
        width: w,
        height: h,
        data: Vec::new(),
    }
}

fn refine_roi(
    hay_w: i32,
    hay_h: i32,
    cx: i32,
    cy: i32,
    nw: i32,
    nh: i32,
) -> Region {
    let margin_x = ROI_PAD_MULT as i32 * nw;
    let margin_y = ROI_PAD_MULT as i32 * nh;
    let left = (cx - margin_x).max(0);
    let top = (cy - margin_y).max(0);
    let right = (cx + margin_x + nw).min(hay_w);
    let bottom = (cy + margin_y + nh).min(hay_h);
    Region {
        left,
        top,
        width: (right - left).max(0),
        height: (bottom - top).max(0),
    }
}

fn region_center(region: &Region) -> (i32, i32) {
    (
        region.left + region.width / 2,
        region.top + region.height / 2,
    )
}

pub fn should_use_pyramid(haystack: &RgbaImage, prepared: &PreparedNeedle, opts: &MatchOptions) -> bool {
    !opts.multi_scale
        && opts.search_region.is_none()
        && haystack.width >= PYRAMID_MIN_HAY_DIM
        && haystack.height >= PYRAMID_MIN_HAY_DIM
        && haystack.width >= PYRAMID_MIN_WIDTH
        && haystack.height >= PYRAMID_MIN_HEIGHT
        && prepared.nw >= 8
        && prepared.nh >= 8
}

pub fn find_single_pyramid(
    haystack: &RgbaImage,
    hay_gray: &[f32],
    prepared: &PreparedNeedle,
    opts: &MatchOptions,
) -> Result<Region> {
    if !should_use_pyramid(haystack, prepared, opts) {
        return find_single(haystack, hay_gray, prepared, opts, None);
    }

    let coarse_w = ((haystack.width as f64) * COARSE_SCALE).round().max(8.0) as u32;
    let coarse_h = ((haystack.height as f64) * COARSE_SCALE).round().max(8.0) as u32;
    let coarse_nw = ((prepared.nw as f64) * COARSE_SCALE).round().max(4.0) as u32;
    let coarse_nh = ((prepared.nh as f64) * COARSE_SCALE).round().max(4.0) as u32;

    if coarse_nw + 4 >= coarse_w || coarse_nh + 4 >= coarse_h {
        return find_single(haystack, hay_gray, prepared, opts, None);
    }

    let coarse_gray = resize_gray(
        hay_gray,
        haystack.width,
        haystack.height,
        coarse_w,
        coarse_h,
    )?;
    let coarse_needle_gray = resize_gray(
        &prepared.gray,
        prepared.nw,
        prepared.nh,
        coarse_nw,
        coarse_nh,
    )?;
    let coarse_prepared = prepare_needle(coarse_needle_gray, coarse_nw, coarse_nh);
    let coarse_hay = dims_haystack(coarse_w, coarse_h);

    let mut coarse_opts = *opts;
    coarse_opts.search_region = None;
    coarse_opts.confidence = (opts.confidence - 0.15).max(0.5);

    let candidates = find_top_k(
        &coarse_hay,
        &coarse_gray,
        &coarse_prepared,
        &coarse_opts,
        TOP_K,
    )?;

    if candidates.is_empty() {
        return find_single(haystack, hay_gray, prepared, opts, None);
    }

    let mut best: Option<(Region, f64)> = None;

    for (coarse_region, _) in candidates {
        let full_region = Region {
            left: coarse_region.left * 2,
            top: coarse_region.top * 2,
            width: coarse_region.width * 2,
            height: coarse_region.height * 2,
        };
        let (cx, cy) = region_center(&full_region);
        let roi = refine_roi(
            haystack.width as i32,
            haystack.height as i32,
            cx,
            cy,
            prepared.nw as i32,
            prepared.nh as i32,
        );
        if roi.width < prepared.nw as i32 || roi.height < prepared.nh as i32 {
            continue;
        }
        let mut fine_opts = *opts;
        fine_opts.search_region = Some(roi);
        if let Ok((region, score)) = find_best(haystack, hay_gray, prepared, &fine_opts, None) {
            if score >= opts.confidence
                && best.as_ref().map(|(_, s)| score > *s).unwrap_or(true)
            {
                best = Some((region, score));
            }
        }
    }

    if let Some((region, score)) = best {
        if score >= opts.confidence {
            if score < 0.99 {
                if let Ok((full_region, full_score)) =
                    find_best(haystack, hay_gray, prepared, opts, None)
                {
                    if full_score > score {
                        return Ok(full_region);
                    }
                }
            }
            return Ok(region);
        }
    }

    find_single(haystack, hay_gray, prepared, opts, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use spotterjs_base::MatchPlugin;
    use crate::NccMatcher;

    fn solid(w: u32, h: u32, fill: [u8; 3]) -> RgbaImage {
        let mut data = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            data.extend_from_slice(&[fill[0], fill[1], fill[2], 255]);
        }
        RgbaImage { width: w, height: h, data }
    }

    fn paint(hay: &mut RgbaImage, px: u32, py: u32, pw: u32, ph: u32, patch: [u8; 3]) {
        for y in 0..ph {
            for x in 0..pw {
                let i = (((py + y) * hay.width + (px + x)) * 4) as usize;
                hay.data[i..i + 3].copy_from_slice(&patch);
            }
        }
    }

    fn needle_from_patch(hay: &RgbaImage, px: u32, py: u32, pw: u32, ph: u32) -> RgbaImage {
        let mut data = Vec::with_capacity((pw * ph * 4) as usize);
        for y in 0..ph {
            for x in 0..pw {
                let i = (((py + y) * hay.width + (px + x)) * 4) as usize;
                data.extend_from_slice(&hay.data[i..i + 4]);
            }
        }
        RgbaImage {
            width: pw,
            height: ph,
            data,
        }
    }

    #[test]
    fn pyramid_finds_patch_on_large_haystack() {
        let mut hay = solid(2000, 1100, [40, 40, 40]);
        paint(&mut hay, 1200, 700, 24, 24, [240, 30, 30]);
        let needle = needle_from_patch(&hay, 1200, 700, 24, 24);
        let opts = MatchOptions {
            confidence: 0.85,
            multi_scale: false,
            ..Default::default()
        };
        let matcher = NccMatcher;
        let found = matcher.find(&hay, &needle, &opts).expect("pyramid find");
        assert!(
            (found.left - 1200).abs() <= 4 && (found.top - 700).abs() <= 4,
            "found={found:?}"
        );
    }
}
