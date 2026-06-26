use akaze::{Akaze, KeyPoint};
use bitarray::BitArray;
use image23::{DynamicImage, ImageBuffer, Rgba};
use space::Neighbor;
use spotterjs_base::{MatchOptions, MatchResult, Region, Result, RgbaImage, SpotterError};

use crate::gray::{rgba_to_luma, validate_rgba};

const LOWES_RATIO: f32 = 0.9;
const MIN_DESCRIPTORS: usize = 8;
const MIN_CANDIDATE_MATCHES: usize = 3;
const MIN_INLIERS: usize = 3;

type Descriptor = BitArray<64>;

#[derive(Clone)]
struct Features {
    keypoints: Vec<KeyPoint>,
    descriptors: Vec<Descriptor>,
}

#[derive(Clone, Copy)]
struct CandidateMatch {
    needle_idx: usize,
    hay_idx: usize,
}

#[derive(Clone, Copy)]
struct PointMatch {
    needle: (f32, f32),
    hay: (f32, f32),
}

#[derive(Clone)]
struct TransformModel {
    scale: f32,
    left: f32,
    top: f32,
    inliers: Vec<PointMatch>,
    residual: f32,
}

fn rgba_to_dynamic(img: &RgbaImage, label: &str) -> Result<DynamicImage> {
    validate_rgba(img, label)?;
    let buffer =
        ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(img.width, img.height, img.data.clone())
            .ok_or_else(|| SpotterError::Image(format!("{label} image buffer is invalid")))?;
    Ok(DynamicImage::ImageRgba8(buffer))
}

fn extract_features(img: &RgbaImage, label: &str) -> Result<Features> {
    let dynamic = rgba_to_dynamic(img, label)?;
    let (keypoints, descriptors) = Akaze::new(0.00001).extract(&dynamic);
    Ok(Features {
        keypoints,
        descriptors,
    })
}

fn no_match(opts: &MatchOptions) -> SpotterError {
    SpotterError::MatchNotFound {
        confidence: opts.confidence,
    }
}

fn crop(img: &RgbaImage, region: Region) -> RgbaImage {
    let mut data = Vec::with_capacity((region.width * region.height * 4) as usize);
    for y in 0..region.height as u32 {
        let src = (((region.top as u32 + y) * img.width + region.left as u32) * 4) as usize;
        let len = region.width as usize * 4;
        data.extend_from_slice(&img.data[src..src + len]);
    }
    RgbaImage {
        width: region.width as u32,
        height: region.height as u32,
        data,
    }
}

fn active_haystack(haystack: &RgbaImage, opts: &MatchOptions) -> Result<(RgbaImage, i32, i32)> {
    validate_rgba(haystack, "haystack")?;
    let Some(region) = opts.search_region else {
        return Ok((haystack.clone(), 0, 0));
    };
    if region.width <= 0 || region.height <= 0 {
        return Err(SpotterError::Plugin(
            "search_region width and height must be positive".into(),
        ));
    }
    let clipped = region.clamp_to_screen(haystack.width as i32, haystack.height as i32);
    if clipped.width <= 0 || clipped.height <= 0 {
        return Err(no_match(opts));
    }
    Ok((crop(haystack, clipped), clipped.left, clipped.top))
}

fn best_ratio_matches(search: &[Descriptor], space: &[Descriptor]) -> Vec<Option<usize>> {
    search
        .iter()
        .map(|descriptor| {
            let mut neighbors = [Neighbor::invalid(); 2];
            if space::linear_knn(descriptor, &mut neighbors, space).len() < 2 {
                return None;
            }
            let best = neighbors[0];
            let second = neighbors[1];
            if best.distance == 0 || (best.distance as f32) < (second.distance as f32 * LOWES_RATIO)
            {
                Some(best.index)
            } else {
                None
            }
        })
        .collect()
}

fn symmetric_matches(needle: &Features, haystack: &Features) -> Vec<CandidateMatch> {
    if needle.descriptors.len() < 2 || haystack.descriptors.len() < 2 {
        return Vec::new();
    }
    let forward = best_ratio_matches(&needle.descriptors, &haystack.descriptors);
    let reverse = best_ratio_matches(&haystack.descriptors, &needle.descriptors);
    forward
        .into_iter()
        .enumerate()
        .filter_map(|(needle_idx, hay_idx)| {
            let hay_idx = hay_idx?;
            if reverse.get(hay_idx).copied().flatten() == Some(needle_idx) {
                Some(CandidateMatch {
                    needle_idx,
                    hay_idx,
                })
            } else {
                None
            }
        })
        .collect()
}

fn median(mut values: Vec<f32>) -> Option<f32> {
    values.retain(|v| v.is_finite());
    if values.is_empty() {
        return None;
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    Some(values[values.len() / 2])
}

fn median_scale(matches: &[PointMatch]) -> f32 {
    let mut scales = Vec::new();
    for i in 0..matches.len() {
        for j in i + 1..matches.len() {
            let ndx = matches[i].needle.0 - matches[j].needle.0;
            let ndy = matches[i].needle.1 - matches[j].needle.1;
            let hdx = matches[i].hay.0 - matches[j].hay.0;
            let hdy = matches[i].hay.1 - matches[j].hay.1;
            let nd = (ndx * ndx + ndy * ndy).sqrt();
            let hd = (hdx * hdx + hdy * hdy).sqrt();
            if nd >= 8.0 {
                let scale = hd / nd;
                if (0.25..=4.0).contains(&scale) {
                    scales.push(scale);
                }
            }
        }
    }
    median(scales).unwrap_or(1.0).clamp(0.25, 4.0)
}

fn inlier_threshold(needle: &RgbaImage, scale: f32) -> f32 {
    ((needle.width.max(needle.height) as f32) * scale * 0.14).clamp(8.0, 28.0)
}

fn residual(m: &PointMatch, scale: f32, left: f32, top: f32) -> f32 {
    let px = left + m.needle.0 * scale;
    let py = top + m.needle.1 * scale;
    let dx = px - m.hay.0;
    let dy = py - m.hay.1;
    (dx * dx + dy * dy).sqrt()
}

fn model_from_scale(
    matches: &[PointMatch],
    needle: &RgbaImage,
    scale: f32,
) -> Option<TransformModel> {
    if !(0.25..=4.0).contains(&scale) {
        return None;
    }
    let left = median(
        matches
            .iter()
            .map(|m| m.hay.0 - m.needle.0 * scale)
            .collect(),
    )?;
    let top = median(
        matches
            .iter()
            .map(|m| m.hay.1 - m.needle.1 * scale)
            .collect(),
    )?;
    let threshold = inlier_threshold(needle, scale);
    let mut inliers = Vec::new();
    let mut residual_sum = 0.0;
    for m in matches {
        let r = residual(m, scale, left, top);
        if r <= threshold {
            inliers.push(*m);
            residual_sum += r;
        }
    }
    Some(TransformModel {
        scale,
        left,
        top,
        inliers,
        residual: residual_sum,
    })
}

fn candidate_scales(matches: &[PointMatch]) -> Vec<f32> {
    let mut scales = vec![median_scale(matches), 1.0];
    for i in 0..matches.len() {
        for j in i + 1..matches.len() {
            let ndx = matches[i].needle.0 - matches[j].needle.0;
            let ndy = matches[i].needle.1 - matches[j].needle.1;
            let hdx = matches[i].hay.0 - matches[j].hay.0;
            let hdy = matches[i].hay.1 - matches[j].hay.1;
            let nd = (ndx * ndx + ndy * ndy).sqrt();
            let hd = (hdx * hdx + hdy * hdy).sqrt();
            if nd >= 8.0 {
                let scale = hd / nd;
                if (0.25..=4.0).contains(&scale) {
                    scales.push(scale);
                }
            }
        }
    }
    scales
}

fn choose_model(matches: &[PointMatch], needle: &RgbaImage) -> Option<TransformModel> {
    let mut best: Option<TransformModel> = None;
    for scale in candidate_scales(matches) {
        let Some(model) = model_from_scale(matches, needle, scale) else {
            continue;
        };
        let replace = match best.as_ref() {
            None => true,
            Some(current) => {
                model.inliers.len() > current.inliers.len()
                    || (model.inliers.len() == current.inliers.len()
                        && model.residual < current.residual)
            }
        };
        if replace {
            best = Some(model);
        }
    }

    let best = best?;
    let refined_scale = median_scale(&best.inliers);
    model_from_scale(&best.inliers, needle, refined_scale).or(Some(best))
}

fn estimate_region(
    matches: &[PointMatch],
    candidate_count: usize,
    needle: &RgbaImage,
    haystack: &RgbaImage,
    offset_x: i32,
    offset_y: i32,
    opts: &MatchOptions,
) -> Result<MatchResult> {
    let model = choose_model(matches, needle).ok_or_else(|| no_match(opts))?;
    if model.inliers.len() < MIN_INLIERS {
        return Err(no_match(opts));
    }

    let width = (needle.width as f32 * model.scale).round().max(1.0) as i32;
    let height = (needle.height as f32 * model.scale).round().max(1.0) as i32;
    let max_left = (haystack.width as i32 - width).max(0);
    let max_top = (haystack.height as i32 - height).max(0);
    let region = Region {
        left: model.left.round().clamp(0.0, max_left as f32) as i32 + offset_x,
        top: model.top.round().clamp(0.0, max_top as f32) as i32 + offset_y,
        width,
        height,
    };
    let inlier_ratio = model.inliers.len() as f64 / candidate_count.max(1) as f64;
    let count_quality = (model.inliers.len() as f64 / 12.0).min(1.0);
    let score = (inlier_ratio * count_quality).clamp(0.0, 1.0);
    if score < opts.confidence {
        return Err(no_match(opts));
    }
    Ok(MatchResult::new(region, score))
}

fn texture_gate(needle: &RgbaImage, opts: &MatchOptions) -> Result<()> {
    let luma = rgba_to_luma(needle)?;
    let mean = luma.iter().copied().sum::<f32>() / luma.len() as f32;
    let variance = luma
        .iter()
        .map(|v| {
            let d = *v - mean;
            d * d
        })
        .sum::<f32>()
        / luma.len() as f32;
    if variance < 0.0004 {
        return Err(no_match(opts));
    }
    Ok(())
}

pub fn find(haystack: &RgbaImage, needle: &RgbaImage, opts: &MatchOptions) -> Result<MatchResult> {
    validate_rgba(needle, "needle")?;
    texture_gate(needle, opts)?;
    let (haystack, offset_x, offset_y) = active_haystack(haystack, opts)?;
    let needle_features = extract_features(needle, "needle")?;
    let hay_features = extract_features(&haystack, "haystack")?;
    if needle_features.descriptors.len() < MIN_DESCRIPTORS
        || hay_features.descriptors.len() < MIN_DESCRIPTORS
    {
        return Err(no_match(opts));
    }

    let candidates = symmetric_matches(&needle_features, &hay_features);
    if candidates.len() < MIN_CANDIDATE_MATCHES {
        return Err(no_match(opts));
    }
    let point_matches: Vec<PointMatch> = candidates
        .iter()
        .map(|m| PointMatch {
            needle: needle_features.keypoints[m.needle_idx].point,
            hay: hay_features.keypoints[m.hay_idx].point,
        })
        .collect();

    estimate_region(
        &point_matches,
        candidates.len(),
        needle,
        &haystack,
        offset_x,
        offset_y,
        opts,
    )
}

pub fn find_all(
    haystack: &RgbaImage,
    needle: &RgbaImage,
    opts: &MatchOptions,
) -> Result<Vec<MatchResult>> {
    Ok(vec![find(haystack, needle, opts)?])
}
