//! OpenCV `matchTemplate` backend with optional multi-scale search.

use opencv::{
    core::{Mat, MatTrait, MatTraitConst, Point, Rect, Scalar, Size, CV_8UC4},
    imgproc::{match_template, COLOR_RGBA2GRAY, TM_CCOEFF_NORMED},
    prelude::*,
};
use spotter_base::{
    MatchOptions, MatchPlugin, Region, Result, RgbaImage, SpotterError,
};

const MAX_TEMPLATE_DIM: u32 = 512;

pub struct OpenCvMatcher;

impl Default for OpenCvMatcher {
    fn default() -> Self {
        Self
    }
}

impl MatchPlugin for OpenCvMatcher {
    fn name(&self) -> &'static str {
        "opencv"
    }

    fn find(&self, haystack: &RgbaImage, needle: &RgbaImage, opts: &MatchOptions) -> Result<Region> {
        if opts.multi_scale {
            let regions = find_multi_scale(haystack, needle, opts, false)?;
            regions
                .into_iter()
                .next()
                .ok_or(SpotterError::MatchNotFound {
                    confidence: opts.confidence,
                })
        } else {
            find_single(haystack, needle, opts)
        }
    }

    fn find_all(
        &self,
        haystack: &RgbaImage,
        needle: &RgbaImage,
        opts: &MatchOptions,
    ) -> Result<Vec<Region>> {
        if opts.multi_scale {
            find_multi_scale(haystack, needle, opts, true)
        } else {
            find_all_single(haystack, needle, opts)
        }
    }
}

pub fn load_rgba_from_path(path: &std::path::Path) -> Result<RgbaImage> {
    let buf = std::fs::read(path).map_err(SpotterError::Io)?;
    let img = image::load_from_memory(&buf).map_err(|e| SpotterError::Image(e.to_string()))?;
    let rgba = img.to_rgba8();
    Ok(RgbaImage {
        width: rgba.width(),
        height: rgba.height(),
        data: rgba.into_raw(),
    })
}

fn opencv_err(e: opencv::Error) -> SpotterError {
    SpotterError::Plugin(format!("opencv: {e}"))
}

fn check_template_size(w: u32, h: u32) -> Result<()> {
    if w > MAX_TEMPLATE_DIM || h > MAX_TEMPLATE_DIM {
        return Err(SpotterError::Plugin(format!(
            "template too large (max {MAX_TEMPLATE_DIM}x{MAX_TEMPLATE_DIM})"
        )));
    }
    Ok(())
}

fn rgba_to_mat_gray(img: &RgbaImage) -> Result<Mat> {
    let size = Size::new(img.width as i32, img.height as i32);
    let mut rgba_mat =
        Mat::new_size_with_default(size, CV_8UC4, Scalar::all(0.0)).map_err(opencv_err)?;
    {
        let dst = rgba_mat.data_bytes_mut().map_err(opencv_err)?;
        if dst.len() != img.data.len() {
            return Err(SpotterError::Image("RGBA size mismatch".into()));
        }
        dst.copy_from_slice(&img.data);
    }
    let mut gray = Mat::default();
    opencv::imgproc::cvt_color(&rgba_mat, &mut gray, COLOR_RGBA2GRAY, 0).map_err(opencv_err)?;
    Ok(gray)
}

fn search_rect(hay_w: i32, hay_h: i32, opts: &MatchOptions) -> Rect {
    let r = opts.search_region.unwrap_or(Region {
        left: 0,
        top: 0,
        width: hay_w,
        height: hay_h,
    });
    let x = r.left.max(0);
    let y = r.top.max(0);
    let w = r.width.min(hay_w - x);
    let h = r.height.min(hay_h - y);
    Rect::new(x, y, w.max(0), h.max(0))
}

fn min_max_loc(result: &Mat) -> Result<(f64, Point)> {
    let mut min_val = 0.0;
    let mut max_val = 0.0;
    let mut min_loc = Point::default();
    let mut max_loc = Point::default();
    opencv::core::min_max_loc(
        result,
        Some(&mut min_val),
        Some(&mut max_val),
        Some(&mut min_loc),
        Some(&mut max_loc),
        &opencv::core::no_array(),
    )
    .map_err(opencv_err)?;
    Ok((max_val, max_loc))
}

fn match_at_scale(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<(Region, f64)> {
    check_template_size(needle.width, needle.height)?;
    let hay_gray = rgba_to_mat_gray(haystack)?;
    let needle_gray = rgba_to_mat_gray(needle)?;
    let roi = search_rect(hay_gray.cols(), hay_gray.rows(), opts);
    if roi.width <= needle_gray.cols() || roi.height <= needle_gray.rows() {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }
    let hay_roi = Mat::roi(&hay_gray, roi).map_err(opencv_err)?;
    let mut result = Mat::default();
    match_template(
        &hay_roi,
        &needle_gray,
        &mut result,
        TM_CCOEFF_NORMED,
        &opencv::core::no_array(),
    )
    .map_err(opencv_err)?;
    let (score, loc) = min_max_loc(&result)?;
    Ok((
        Region {
            left: roi.x + loc.x,
            top: roi.y + loc.y,
            width: needle.width as i32,
            height: needle.height as i32,
        },
        score,
    ))
}

fn find_single(haystack: &RgbaImage, needle: &RgbaImage, opts: &MatchOptions) -> Result<Region> {
    let (region, score) = match_at_scale(haystack, needle, opts)?;
    if score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }
    Ok(region)
}

fn find_all_single(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<Vec<Region>> {
    check_template_size(needle.width, needle.height)?;
    let hay_gray = rgba_to_mat_gray(haystack)?;
    let needle_gray = rgba_to_mat_gray(needle)?;
    let roi = search_rect(hay_gray.cols(), hay_gray.rows(), opts);
    let hay_roi = Mat::roi(&hay_gray, roi).map_err(opencv_err)?;
    let mut result = Mat::default();
    match_template(
        &hay_roi,
        &needle_gray,
        &mut result,
        TM_CCOEFF_NORMED,
        &opencv::core::no_array(),
    )
    .map_err(opencv_err)?;

    let mut matches = Vec::new();
    let nw = needle.width as i32;
    let nh = needle.height as i32;
    let mut work = result.clone();
    for _ in 0..20 {
        let (score, loc) = min_max_loc(&work)?;
        if score < opts.confidence {
            break;
        }
        let region = Region {
            left: roi.x + loc.x,
            top: roi.y + loc.y,
            width: nw,
            height: nh,
        };
        if matches.iter().any(|r| regions_overlap(r, &region)) {
            break;
        }
        matches.push(region);
        suppress_peak(&mut work, loc, nw, nh);
    }
    if matches.is_empty() {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }
    Ok(matches)
}

fn suppress_peak(mat: &mut Mat, loc: Point, w: i32, h: i32) {
    let x0 = (loc.x - w / 2).max(0);
    let y0 = (loc.y - h / 2).max(0);
    let x1 = (loc.x + w / 2).min(mat.cols());
    let y1 = (loc.y + h / 2).min(mat.rows());
    for y in y0..y1 {
        for x in x0..x1 {
            if let Ok(v) = mat.at_2d_mut::<f32>(y, x) {
                *v = 0.0;
            }
        }
    }
}

fn regions_overlap(a: &Region, b: &Region) -> bool {
    let dx = (a.left - b.left).abs();
    let dy = (a.top - b.top).abs();
    dx < a.width / 2 && dy < a.height / 2
}

fn scale_needle_rgba(needle: &RgbaImage, w: u32, h: u32) -> Result<RgbaImage> {
    let src = image::RgbaImage::from_raw(needle.width, needle.height, needle.data.clone())
        .ok_or_else(|| SpotterError::Image("invalid needle rgba".into()))?;
    let resized = image::imageops::resize(&src, w, h, image::imageops::FilterType::Triangle);
    Ok(RgbaImage {
        width: w,
        height: h,
        data: resized.into_raw(),
    })
}

fn find_multi_scale(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
    collect_all: bool,
) -> Result<Vec<Region>> {
    let mut scale = opts.scale_min;
    let mut best: Option<(Region, f64)> = None;
    let mut all = Vec::new();

    while scale <= opts.scale_max + 1e-6 {
        let nw = ((needle.width as f64) * scale).round().max(4.0) as u32;
        let nh = ((needle.height as f64) * scale).round().max(4.0) as u32;
        let scaled = scale_needle_rgba(needle, nw, nh)?;
        let mut local_opts = *opts;
        local_opts.multi_scale = false;

        if collect_all {
            if let Ok(mut found) = find_all_single(haystack, &scaled, &local_opts) {
                all.append(&mut found);
            }
        } else if let Ok((region, score)) = match_at_scale(haystack, &scaled, &local_opts) {
            if score >= opts.confidence {
                if best.as_ref().map(|(_, s)| *s).unwrap_or(f64::MIN) < score {
                    best = Some((region, score));
                }
            }
        }
        scale += opts.scale_step;
    }

    if collect_all {
        if all.is_empty() {
            return Err(SpotterError::MatchNotFound {
                confidence: opts.confidence,
            });
        }
        return Ok(dedupe_regions(all));
    }

    let (region, score) = best.ok_or(SpotterError::MatchNotFound {
        confidence: opts.confidence,
    })?;
    if score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }
    Ok(vec![region])
}

fn dedupe_regions(regions: Vec<Region>) -> Vec<Region> {
    let mut out = Vec::new();
    for r in regions {
        if !out.iter().any(|o| regions_overlap(o, &r)) {
            out.push(r);
        }
    }
    out
}
