use crate::capture::capture_screen;
use crate::error::{Result, SpotterError};
use crate::types::{Region, RgbaImage};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct DiffStats {
    pub mean_abs_diff: f64,
    pub changed_fraction: f64,
}

pub fn region_diff(
    previous: &RgbaImage,
    current: &RgbaImage,
    per_pixel_threshold: u8,
) -> Result<DiffStats> {
    validate_same_shape(previous, current)?;

    let pixels = (previous.width * previous.height) as usize;
    if pixels == 0 {
        return Ok(DiffStats {
            mean_abs_diff: 0.0,
            changed_fraction: 0.0,
        });
    }

    let mut total = 0.0f64;
    let mut changed = 0usize;
    for (a, b) in previous
        .data
        .chunks_exact(4)
        .zip(current.data.chunks_exact(4))
    {
        let dr = a[0].abs_diff(b[0]) as f64;
        let dg = a[1].abs_diff(b[1]) as f64;
        let db = a[2].abs_diff(b[2]) as f64;
        let pixel = (dr + dg + db) / 3.0;
        total += pixel;
        if pixel > per_pixel_threshold as f64 {
            changed += 1;
        }
    }

    Ok(DiffStats {
        mean_abs_diff: total / pixels as f64,
        changed_fraction: changed as f64 / pixels as f64,
    })
}

pub fn region_changed(
    region: Option<Region>,
    previous: &RgbaImage,
    threshold: f64,
    per_pixel_threshold: u8,
) -> Result<bool> {
    let current = capture_screen(region)?;
    Ok(region_diff(previous, &current, per_pixel_threshold)?.changed_fraction > threshold)
}

pub fn wait_for_screen_stable(
    region: Option<Region>,
    threshold: f64,
    settle_ms: u64,
    timeout_ms: u64,
    interval_ms: Option<u64>,
) -> Result<bool> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(interval_ms.unwrap_or(100));
    let mut stable_since: Option<Instant> = None;
    let mut previous = capture_screen(region)?;

    loop {
        thread::sleep(interval);
        let current = capture_screen(region)?;
        let stats = region_diff(&previous, &current, 0)?;
        let now = Instant::now();

        if stats.changed_fraction <= threshold {
            let since = *stable_since.get_or_insert(now);
            if now.duration_since(since) >= Duration::from_millis(settle_ms) {
                return Ok(true);
            }
        } else {
            stable_since = None;
        }

        if now >= deadline {
            return Err(SpotterError::MatchTimeout { timeout_ms });
        }
        previous = current;
    }
}

fn validate_same_shape(previous: &RgbaImage, current: &RgbaImage) -> Result<()> {
    if previous.width != current.width || previous.height != current.height {
        return Err(SpotterError::Image(format!(
            "capture dimensions differ: {}x{} vs {}x{}",
            previous.width, previous.height, current.width, current.height
        )));
    }
    let expected = (previous.width * previous.height * 4) as usize;
    if previous.data.len() != expected || current.data.len() != expected {
        return Err(SpotterError::Image("invalid RGBA buffer length".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(pixels: &[[u8; 3]]) -> RgbaImage {
        let mut data = Vec::with_capacity(pixels.len() * 4);
        for [r, g, b] in pixels {
            data.extend_from_slice(&[*r, *g, *b, 255]);
        }
        RgbaImage {
            width: pixels.len() as u32,
            height: 1,
            data,
        }
    }

    #[test]
    fn region_diff_reports_mean_and_changed_fraction() {
        let a = image(&[[0, 0, 0], [10, 10, 10], [30, 30, 30], [100, 100, 100]]);
        let b = image(&[[0, 0, 0], [12, 12, 12], [45, 45, 45], [130, 130, 130]]);

        let stats = region_diff(&a, &b, 10).unwrap();

        assert!((stats.mean_abs_diff - 11.75).abs() < 1e-6);
        assert_eq!(stats.changed_fraction, 0.5);
    }

    #[test]
    fn region_diff_rejects_shape_mismatch() {
        let err = region_diff(
            &RgbaImage {
                width: 1,
                height: 1,
                data: vec![0, 0, 0, 255],
            },
            &RgbaImage {
                width: 2,
                height: 1,
                data: vec![0, 0, 0, 255, 0, 0, 0, 255],
            },
            0,
        )
        .unwrap_err();

        assert!(matches!(err, SpotterError::Image(_)));
    }
}
