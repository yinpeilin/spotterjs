use spotterjs_base::{MatchOptions, MatchResult, Region, Result, RgbaImage, SpotterError};

use crate::gray::{resize_gray, rgba_to_gray, scaled_dims};
use crate::ncc::{find_best, find_single, prepare_needle};
use crate::pyramid::find_single_pyramid;
use crate::util::regions_overlap;

#[cfg(feature = "parallel")]
use rayon::prelude::*;

fn scale_list(opts: &MatchOptions) -> Vec<f64> {
    let mut scales = Vec::new();
    let mut scale = opts.scale_min;
    while scale <= opts.scale_max + 1e-6 {
        scales.push(scale);
        scale += opts.scale_step;
    }
    scales
}

fn validate_scale_options(opts: &MatchOptions) -> Result<()> {
    if !opts.scale_min.is_finite() || !opts.scale_max.is_finite() || !opts.scale_step.is_finite() {
        return Err(SpotterError::Plugin("scale values must be finite".into()));
    }
    if opts.scale_min <= 0.0 || opts.scale_max <= 0.0 || opts.scale_step <= 0.0 {
        return Err(SpotterError::Plugin("scale values must be positive".into()));
    }
    if opts.scale_min > opts.scale_max {
        return Err(SpotterError::Plugin(
            "scale_min must be less than or equal to scale_max".into(),
        ));
    }
    if ((opts.scale_max - opts.scale_min) / opts.scale_step).ceil() > 256.0 {
        return Err(SpotterError::Plugin(
            "scale range has too many steps".into(),
        ));
    }
    Ok(())
}

struct ScaleContext<'a> {
    haystack: &'a RgbaImage,
    hay_gray: &'a [f32],
    needle_gray: &'a [f32],
    needle_w: u32,
    needle_h: u32,
    opts: &'a MatchOptions,
}

fn try_scale_match(ctx: &ScaleContext<'_>, scale: f64) -> Option<(Region, f64)> {
    let (nw, nh) = scaled_dims(ctx.needle_w, ctx.needle_h, scale);
    if nw > ctx.haystack.width || nh > ctx.haystack.height {
        return None;
    }
    let needle_gray = resize_gray(ctx.needle_gray, ctx.needle_w, ctx.needle_h, nw, nh).ok()?;
    let mut local_opts = *ctx.opts;
    local_opts.multi_scale = false;
    let prepared = prepare_needle(needle_gray, nw, nh);
    let (region, score) =
        find_best(ctx.haystack, ctx.hay_gray, &prepared, &local_opts, None).ok()?;
    if score >= ctx.opts.confidence {
        Some((region, score))
    } else {
        None
    }
}

fn dedupe_match_results(matches: Vec<MatchResult>) -> Vec<MatchResult> {
    let mut out: Vec<MatchResult> = Vec::new();
    for found in matches {
        if !out
            .iter()
            .any(|m| regions_overlap(&m.region, &found.region))
        {
            out.push(found);
        }
    }
    out
}

pub fn find_multi_scale(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
    collect_all: bool,
) -> Result<Vec<MatchResult>> {
    validate_scale_options(opts)?;
    let hay_gray = rgba_to_gray(haystack)?;
    let needle_gray = rgba_to_gray(needle)?;
    let scales = scale_list(opts);

    if collect_all {
        let mut all = Vec::new();
        for scale in scales {
            let (nw, nh) = scaled_dims(needle.width, needle.height, scale);
            if nw > haystack.width || nh > haystack.height {
                continue;
            }
            let scaled_gray = resize_gray(&needle_gray, needle.width, needle.height, nw, nh)?;
            let mut local_opts = *opts;
            local_opts.multi_scale = false;
            if let Ok(mut found) =
                find_all_single_scale(haystack, &hay_gray, scaled_gray, nw, nh, &local_opts)
            {
                all.append(&mut found);
            }
        }
        if all.is_empty() {
            return Err(SpotterError::MatchNotFound {
                confidence: opts.confidence,
            });
        }
        return Ok(dedupe_match_results(all));
    }

    let ctx = ScaleContext {
        haystack,
        hay_gray: &hay_gray,
        needle_gray: &needle_gray,
        needle_w: needle.width,
        needle_h: needle.height,
        opts,
    };

    #[cfg(feature = "parallel")]
    let best = scales
        .par_iter()
        .filter_map(|&scale| try_scale_match(&ctx, scale))
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    #[cfg(not(feature = "parallel"))]
    let best = scales
        .iter()
        .filter_map(|&scale| try_scale_match(&ctx, scale))
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let (region, score) = best.ok_or(SpotterError::MatchNotFound {
        confidence: opts.confidence,
    })?;
    if score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }
    Ok(vec![MatchResult::new(region, score)])
}

fn find_all_single_scale(
    haystack: &RgbaImage,
    hay_gray: &[f32],
    needle_gray: Vec<f32>,
    nw: u32,
    nh: u32,
    opts: &MatchOptions,
) -> Result<Vec<MatchResult>> {
    let prepared = prepare_needle(needle_gray, nw, nh);
    let mut blocked = vec![false; hay_gray.len()];
    let mut local_opts = *opts;
    if local_opts.search_region.is_none() {
        local_opts.search_region = Some(spotterjs_base::Region {
            left: 0,
            top: 0,
            width: haystack.width as i32,
            height: haystack.height as i32,
        });
    }

    let mut all: Vec<MatchResult> = Vec::new();
    for _ in 0..10 {
        match find_single(haystack, hay_gray, &prepared, &local_opts, Some(&blocked)) {
            Ok(found) => {
                let region = found.region;
                if all.iter().any(|m| regions_overlap(&m.region, &region)) {
                    break;
                }
                crate::util::mark_region_blocked(&mut blocked, haystack.width, &region);
                all.push(found);
            }
            Err(SpotterError::MatchNotFound { .. }) => break,
            Err(e) => return Err(e),
        }
    }
    Ok(all)
}

pub fn find_with_multiscale(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<MatchResult> {
    if opts.multi_scale {
        find_multi_scale(haystack, needle, opts, false)?
            .into_iter()
            .next()
            .ok_or(SpotterError::MatchNotFound {
                confidence: opts.confidence,
            })
    } else {
        let hay_gray = rgba_to_gray(haystack)?;
        let needle_gray = rgba_to_gray(needle)?;
        let prepared = prepare_needle(needle_gray, needle.width, needle.height);
        find_single_pyramid(haystack, &hay_gray, &prepared, opts)
    }
}

pub fn find_all_with_multiscale(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<Vec<MatchResult>> {
    if opts.multi_scale {
        find_multi_scale(haystack, needle, opts, true)
    } else {
        let hay_gray = rgba_to_gray(haystack)?;
        let needle_gray = rgba_to_gray(needle)?;
        find_all_single_scale(
            haystack,
            &hay_gray,
            needle_gray,
            needle.width,
            needle.height,
            opts,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(width: u32, height: u32) -> RgbaImage {
        RgbaImage {
            width,
            height,
            data: vec![255; (width * height * 4) as usize],
        }
    }

    #[test]
    fn invalid_scale_config_returns_plugin_error() {
        let haystack = image(16, 16);
        let needle = image(4, 4);
        let mut opts = MatchOptions::default();
        opts.multi_scale = true;
        opts.scale_min = 1.0;
        opts.scale_max = 2.0;
        opts.scale_step = 0.0;

        let err = find_with_multiscale(&haystack, &needle, &opts).unwrap_err();
        assert!(format!("{err}").contains("scale"));
    }

    #[test]
    fn too_many_scale_steps_are_rejected() {
        let haystack = image(32, 32);
        let needle = image(4, 4);
        let mut opts = MatchOptions::default();
        opts.multi_scale = true;
        opts.scale_min = 0.5;
        opts.scale_max = 4.5;
        opts.scale_step = 0.01;

        let err = find_with_multiscale(&haystack, &needle, &opts).unwrap_err();
        assert!(format!("{err}").contains("too many steps"));
    }
}
