//! Single-scale normalized cross-correlation (TM_CCOEFF_NORMED equivalent).

use spotterjs_base::{MatchOptions, MatchResult, Region, Result, RgbaImage, SpotterError};

use crate::integral::IntegralImage;

pub const MAX_TEMPLATE_DIM: u32 = 512;

pub struct PreparedNeedle {
    pub gray: Vec<f32>,
    pub centered_f32: Vec<f32>,
    pub norm: f64,
    pub mean: f64,
    pub nw: u32,
    pub nh: u32,
}

pub fn prepare_needle(gray: Vec<f32>, nw: u32, nh: u32) -> PreparedNeedle {
    let n = gray.len() as f64;
    let mean = gray.iter().map(|&v| v as f64).sum::<f64>() / n;
    let mut centered_f32 = Vec::with_capacity(gray.len());
    let mut sum_sq = 0.0f64;
    for &v in &gray {
        let c = v as f64 - mean;
        centered_f32.push(c as f32);
        sum_sq += c * c;
    }
    PreparedNeedle {
        gray,
        centered_f32,
        norm: sum_sq.sqrt(),
        mean,
        nw,
        nh,
    }
}

pub fn check_template_size(nw: u32, nh: u32) -> Result<()> {
    if nw > MAX_TEMPLATE_DIM || nh > MAX_TEMPLATE_DIM {
        return Err(SpotterError::Plugin(format!(
            "NCC template too large (max {MAX_TEMPLATE_DIM}x{MAX_TEMPLATE_DIM})"
        )));
    }
    if nw == 0 || nh == 0 {
        return Err(SpotterError::Plugin("template has zero size".into()));
    }
    Ok(())
}

#[inline]
fn n_pixels(nw: u32, nh: u32) -> f64 {
    (nw * nh) as f64
}

#[inline]
fn norm_h_from_stats(sum_h: f64, sum_sq_h: f64, n: f64) -> f64 {
    (sum_sq_h - n * (sum_h / n).powi(2)).max(0.0).sqrt()
}

#[inline]
fn score_from_dot(dot: f64, norm_h: f64, norm_n: f64, mean_h: f64, mean_n: f64) -> f64 {
    let denom = norm_h * norm_n;
    if denom <= 1e-10 {
        if (mean_h - mean_n).abs() <= 1e-6 {
            return 1.0;
        }
        return 0.0;
    }
    dot / denom
}

fn dot_window(hay: &[f32], hay_w: u32, needle: &PreparedNeedle, ox: u32, oy: u32) -> f64 {
    let nw = needle.nw;
    let nh = needle.nh;
    let mut dot = 0.0f64;
    for ty in 0..nh {
        let row = ((oy + ty) * hay_w + ox) as usize;
        let nc = (ty * nw) as usize;
        dot += crate::simd::dot_f32(
            &hay[row..row + nw as usize],
            &needle.centered_f32[nc..nc + nw as usize],
        );
    }
    dot
}

/// Incremental dot product when the match window moves right by one pixel.
///
/// `dot(ox+1) - dot(ox)` is not only the entering/leaving column; interior pixels
/// re-align with different template coefficients (`n[i]` vs `n[i+1]`).
#[inline]
fn slide_dot_horizontal(
    dot: f64,
    hay: &[f32],
    hay_w: u32,
    needle: &PreparedNeedle,
    ox: u32,
    oy: u32,
) -> f64 {
    let nw = needle.nw;
    let nh = needle.nh;
    let nw_u = nw as usize;
    let nh_u = nh as usize;
    debug_assert!(nh_u <= MAX_TEMPLATE_DIM as usize);
    let mut delta = 0.0f64;
    for ty in 0..nh {
        let row = ((oy + ty) * hay_w + ox) as usize;
        let nc = (ty * nw) as usize;
        let h_row = &hay[row..row + nw_u + 1];
        let n_row = &needle.centered_f32[nc..nc + nw_u];
        delta += h_row[nw_u] as f64 * n_row[nw_u - 1] as f64;
        delta -= h_row[0] as f64 * n_row[0] as f64;
        if nw_u > 1 {
            for i in 0..nw_u - 1 {
                delta += h_row[1 + i] as f64 * (n_row[i] as f64 - n_row[i + 1] as f64);
            }
        }
    }
    dot + delta
}

fn ncc_at_prepared(
    hay: &[f32],
    hay_w: u32,
    integral: &IntegralImage,
    needle: &PreparedNeedle,
    ox: u32,
    oy: u32,
) -> f64 {
    let n = n_pixels(needle.nw, needle.nh);
    let (sum_h, sum_sq_h) = integral.rect_stats(ox, oy, ox + needle.nw, oy + needle.nh);
    let mean_h = sum_h / n;
    let norm_h = norm_h_from_stats(sum_h, sum_sq_h, n);
    let dot = dot_window(hay, hay_w, needle, ox, oy);
    score_from_dot(dot, norm_h, needle.norm, mean_h, needle.mean)
}

/// Reference NCC at one position (used by unit tests).
#[cfg(test)]
pub fn ncc_at(hay: &[f32], hay_w: u32, needle: &PreparedNeedle, ox: u32, oy: u32) -> f64 {
    let integral = IntegralImage::from_gray(hay, hay_w, hay.len() as u32 / hay_w);
    ncc_at_prepared(hay, hay_w, &integral, needle, ox, oy)
}

pub fn search_bounds(
    hay_w: u32,
    hay_h: u32,
    _nw: u32,
    _nh: u32,
    opts: &MatchOptions,
) -> (u32, u32, u32, u32) {
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
    (x0, y0, x1, y1)
}

pub(crate) fn validate_search_region(opts: &MatchOptions) -> Result<()> {
    if let Some(region) = opts.search_region {
        if region.width <= 0 || region.height <= 0 {
            return Err(SpotterError::Plugin(
                "search_region width and height must be positive".into(),
            ));
        }
    }
    Ok(())
}

pub(crate) fn scan_row_best_from_dot(
    hay: &[f32],
    hay_w: u32,
    integral: &IntegralImage,
    needle: &PreparedNeedle,
    oy: u32,
    x0: u32,
    x1: u32,
    mut dot: f64,
) -> (f64, u32) {
    let n = n_pixels(needle.nw, needle.nh);
    let ox_end = x1 - needle.nw;
    let mut best_score = f64::MIN;
    let mut best_x = x0;

    for ox in x0..=ox_end {
        let (sum_h, sum_sq_h) = integral.rect_stats(ox, oy, ox + needle.nw, oy + needle.nh);
        let mean_h = sum_h / n;
        let norm_h = norm_h_from_stats(sum_h, sum_sq_h, n);
        let s = score_from_dot(dot, norm_h, needle.norm, mean_h, needle.mean);
        if s > best_score {
            best_score = s;
            best_x = ox;
        }
        if ox < ox_end {
            dot = slide_dot_horizontal(dot, hay, hay_w, needle, ox, oy);
        }
    }

    (best_score, best_x)
}

pub(crate) fn scan_row_best(
    hay: &[f32],
    hay_w: u32,
    integral: &IntegralImage,
    needle: &PreparedNeedle,
    oy: u32,
    x0: u32,
    x1: u32,
) -> (f64, u32) {
    let dot = dot_window(hay, hay_w, needle, x0, oy);
    scan_row_best_from_dot(hay, hay_w, integral, needle, oy, x0, x1, dot)
}

fn find_best_fast(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
) -> Result<(Region, f64)> {
    check_template_size(needle.nw, needle.nh)?;
    validate_search_region(opts)?;
    let hay_w = haystack.width;
    let hay_h = haystack.height;
    let (x0, y0, x1, y1) = search_bounds(hay_w, hay_h, needle.nw, needle.nh, opts);

    if x1 < x0 + needle.nw || y1 < y0 + needle.nh {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    let integral = IntegralImage::from_gray(hay, hay_w, hay_h);
    let y_end = y1 - needle.nh;
    let mut best_score = f64::MIN;
    let mut best_xy = (0u32, 0u32);

    for oy in y0..=y_end {
        let (s, ox) = scan_row_best(hay, hay_w, &integral, needle, oy, x0, x1);
        if s > best_score {
            best_score = s;
            best_xy = (ox, oy);
        }
    }

    if best_score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    Ok((
        Region {
            left: best_xy.0 as i32,
            top: best_xy.1 as i32,
            width: needle.nw as i32,
            height: needle.nh as i32,
        },
        best_score,
    ))
}

pub fn find_best_serial(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
    blocked: Option<&[bool]>,
) -> Result<(Region, f64)> {
    if blocked.is_none() {
        return find_best_fast(haystack, hay, needle, opts);
    }

    check_template_size(needle.nw, needle.nh)?;
    validate_search_region(opts)?;
    let hay_w = haystack.width;
    let hay_h = haystack.height;
    let (x0, y0, x1, y1) = search_bounds(hay_w, hay_h, needle.nw, needle.nh, opts);

    if x1 < x0 + needle.nw || y1 < y0 + needle.nh {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    let integral = IntegralImage::from_gray(hay, hay_w, hay_h);
    let mut best_score = f64::MIN;
    let mut best_xy = (0u32, 0u32);

    for oy in y0..=(y1 - needle.nh) {
        for ox in x0..=(x1 - needle.nw) {
            if blocked.is_some_and(|mask| {
                super::util::window_blocked(mask, hay_w, needle.nw, needle.nh, ox, oy)
            }) {
                continue;
            }
            let s = ncc_at_prepared(hay, hay_w, &integral, needle, ox, oy);
            if s > best_score {
                best_score = s;
                best_xy = (ox, oy);
            }
        }
    }

    if best_score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    Ok((
        Region {
            left: best_xy.0 as i32,
            top: best_xy.1 as i32,
            width: needle.nw as i32,
            height: needle.nh as i32,
        },
        best_score,
    ))
}

pub fn find_best(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
    blocked: Option<&[bool]>,
) -> Result<(Region, f64)> {
    if blocked.is_some() {
        return find_best_serial(haystack, hay, needle, opts, blocked);
    }
    #[cfg(feature = "parallel")]
    {
        return super::parallel::find_best_parallel(haystack, hay, needle, opts);
    }
    #[cfg(not(feature = "parallel"))]
    find_best_fast(haystack, hay, needle, opts)
}

fn push_top_k(top: &mut Vec<(Region, f64)>, k: usize, region: Region, score: f64) {
    if top.len() < k {
        top.push((region, score));
        return;
    }
    if let Some((min_idx, _)) = top.iter().enumerate().min_by(|a, b| {
        a.1 .1
            .partial_cmp(&b.1 .1)
            .unwrap_or(std::cmp::Ordering::Equal)
    }) {
        if score > top[min_idx].1 {
            top[min_idx] = (region, score);
        }
    }
}

/// Collect top-K match candidates by score (for pyramid coarse pass).
pub(crate) fn find_top_k(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
    k: usize,
) -> Result<Vec<(Region, f64)>> {
    check_template_size(needle.nw, needle.nh)?;
    validate_search_region(opts)?;
    let hay_w = haystack.width;
    let hay_h = haystack.height;
    let (x0, y0, x1, y1) = search_bounds(hay_w, hay_h, needle.nw, needle.nh, opts);

    if x1 < x0 + needle.nw || y1 < y0 + needle.nh {
        return Ok(Vec::new());
    }

    let integral = IntegralImage::from_gray(hay, hay_w, hay_h);
    let n = n_pixels(needle.nw, needle.nh);
    let ox_end = x1 - needle.nw;
    let mut top = Vec::with_capacity(k);

    for oy in y0..=(y1 - needle.nh) {
        let mut dot = dot_window(hay, hay_w, needle, x0, oy);
        for ox in x0..=ox_end {
            let (sum_h, sum_sq_h) = integral.rect_stats(ox, oy, ox + needle.nw, oy + needle.nh);
            let mean_h = sum_h / n;
            let norm_h = norm_h_from_stats(sum_h, sum_sq_h, n);
            let s = score_from_dot(dot, norm_h, needle.norm, mean_h, needle.mean);
            push_top_k(
                &mut top,
                k,
                Region {
                    left: ox as i32,
                    top: oy as i32,
                    width: needle.nw as i32,
                    height: needle.nh as i32,
                },
                s,
            );
            if ox < ox_end {
                dot = slide_dot_horizontal(dot, hay, hay_w, needle, ox, oy);
            }
        }
    }

    top.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    Ok(top)
}

pub fn find_single(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
    blocked: Option<&[bool]>,
) -> Result<MatchResult> {
    let active_blocked = blocked.filter(|mask| mask.iter().any(|&b| b));
    find_best(haystack, hay, needle, opts, active_blocked)
        .map(|(region, score)| MatchResult::new(region, score))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn needle_from_patch(
        hay: &[f32],
        hay_w: u32,
        px: u32,
        py: u32,
        nw: u32,
        nh: u32,
    ) -> PreparedNeedle {
        let mut gray = Vec::with_capacity((nw * nh) as usize);
        for ty in 0..nh {
            for tx in 0..nw {
                gray.push(hay[((py + ty) * hay_w + (px + tx)) as usize]);
            }
        }
        prepare_needle(gray, nw, nh)
    }

    /// Gradient plus icon regression fixture for horizontal slide (see #slide bug).
    fn gradient_icon_fixture() -> (Vec<f32>, u32, u32, PreparedNeedle, u32, u32) {
        let w = 400u32;
        let h = 300u32;
        let mut hay = vec![0f32; (w * h) as usize];
        for y in 0..h {
            for x in 0..w {
                let i = (y * w + x) as usize;
                hay[i] = (0.299 * ((x * 255) / w.max(1)) as f32
                    + 0.587 * ((y * 255) / h.max(1)) as f32
                    + 0.114 * (((x + y) * 128) / (w + h).max(1)) as f32)
                    / 255.0;
            }
        }
        let px = 120u32;
        let py = 80u32;
        let nw = 32u32;
        let nh = 32u32;
        let palette: [[f32; 3]; 4] = [
            [220.0, 60.0, 40.0],
            [40.0, 180.0, 220.0],
            [80.0, 200.0, 60.0],
            [200.0, 180.0, 50.0],
        ];
        for row in 0..nh {
            for col in 0..nw {
                let i = ((py + row) * w + (px + col)) as usize;
                let c = palette[((row + col) % 4) as usize];
                hay[i] = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255.0;
            }
        }
        let needle = needle_from_patch(&hay, w, px, py, nw, nh);
        (hay, w, h, needle, px, py)
    }

    #[test]
    fn slide_dot_step_matches_dot_window_delta() {
        let (hay, w, _h, needle, px, py) = gradient_icon_fixture();
        let ox_end = w - needle.nw;
        let mut dot = dot_window(&hay, w, &needle, 0, py);
        for ox in 0..=ox_end {
            let expected = dot_window(&hay, w, &needle, ox, py);
            assert!(
                (dot - expected).abs() < 1e-4,
                "ox={ox} slide_dot={dot} dot_window={expected}"
            );
            if ox == px {
                assert!((dot - expected).abs() < 1e-6);
            }
            if ox < ox_end {
                dot = slide_dot_horizontal(dot, &hay, w, &needle, ox, py);
            }
        }
    }

    #[test]
    fn fast_matches_naive_at_sample_positions() {
        let w = 64u32;
        let h = 64u32;
        let mut hay = vec![0.0f32; (w * h) as usize];
        for y in 0..h {
            for x in 0..w {
                hay[(y * w + x) as usize] = ((x + y * 3) % 256) as f32;
            }
        }
        let needle = needle_from_patch(&hay, w, 10, 15, 8, 8);
        let integral = IntegralImage::from_gray(&hay, w, h);
        for (ox, oy) in [(10, 15), (0, 0), (20, 30), (40, 40)] {
            let fast = ncc_at_prepared(&hay, w, &integral, &needle, ox, oy);
            let naive = ncc_at(&hay, w, &needle, ox, oy);
            assert!(
                (fast - naive).abs() < 1e-6,
                "ox={ox} oy={oy} fast={fast} naive={naive}"
            );
        }
    }

    #[test]
    fn invalid_search_region_returns_plugin_error() {
        let haystack = RgbaImage {
            width: 16,
            height: 16,
            data: vec![255; 16 * 16 * 4],
        };
        let hay = vec![1.0f32; 16 * 16];
        let needle = prepare_needle(vec![1.0; 4 * 4], 4, 4);
        let mut opts = MatchOptions::default();
        opts.search_region = Some(Region {
            left: 0,
            top: 0,
            width: 0,
            height: 4,
        });

        let err = find_best(&haystack, &hay, &needle, &opts, None).unwrap_err();
        assert!(format!("{err:?}").contains("search_region"));
    }

    #[test]
    fn oversized_template_is_rejected() {
        let err = check_template_size(MAX_TEMPLATE_DIM + 1, 8).unwrap_err();

        assert!(format!("{err}").contains("too large"));
    }

    #[test]
    fn top_k_results_are_sorted_by_score_and_limited() {
        let w = 32u32;
        let h = 20u32;
        let mut hay = vec![0.0f32; (w * h) as usize];
        for y in 0..h {
            for x in 0..w {
                hay[(y * w + x) as usize] = ((x * 7 + y * 11) % 255) as f32;
            }
        }
        let needle = needle_from_patch(&hay, w, 5, 6, 5, 4);
        let haystack = RgbaImage {
            width: w,
            height: h,
            data: vec![255; (w * h * 4) as usize],
        };

        let top = find_top_k(&haystack, &hay, &needle, &MatchOptions::default(), 3).unwrap();

        assert_eq!(top.len(), 3);
        assert!(top.windows(2).all(|pair| pair[0].1 >= pair[1].1));
        assert!(top
            .iter()
            .any(|(region, _)| region.width == 5 && region.height == 4));
    }
}
