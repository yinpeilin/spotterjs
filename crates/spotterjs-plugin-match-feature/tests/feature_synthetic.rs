use spotterjs_base::{MatchOptions, MatchPlugin, RgbaImage, SpotterError};
use spotterjs_plugin_match_feature::FeatureMatcher;

fn blank(w: u32, h: u32, rgb: [u8; 3]) -> RgbaImage {
    let mut data = vec![0u8; (w * h * 4) as usize];
    for px in data.chunks_mut(4) {
        px.copy_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
    }
    RgbaImage {
        width: w,
        height: h,
        data,
    }
}

fn put_pixel(img: &mut RgbaImage, x: u32, y: u32, rgb: [u8; 3]) {
    let i = ((y * img.width + x) * 4) as usize;
    img.data[i..i + 3].copy_from_slice(&rgb);
}

fn get_pixel(img: &RgbaImage, x: u32, y: u32) -> [u8; 3] {
    let i = ((y * img.width + x) * 4) as usize;
    [img.data[i], img.data[i + 1], img.data[i + 2]]
}

fn draw_textured_icon(w: u32, h: u32) -> RgbaImage {
    let mut img = blank(w, h, [40, 40, 40]);
    for y in 0..h {
        for x in 0..w {
            let diagonal = x.abs_diff(y) <= 2 || (w - 1 - x).abs_diff(y) <= 2;
            let grid = x % 13 == 0 || y % 11 == 0;
            let dot = (x + y * 3) % 29 == 0;
            let rgb = if diagonal {
                [245, 245, 245]
            } else if grid {
                [35, 160, 230]
            } else if dot {
                [240, 90, 40]
            } else {
                let v = ((x * 17 + y * 31) % 155 + 55) as u8;
                [v, 255u8.saturating_sub(v / 2), v / 3]
            };
            put_pixel(&mut img, x, y, rgb);
        }
    }
    img
}

fn lerp(a: u8, b: u8, t: f32) -> f32 {
    a as f32 + (b as f32 - a as f32) * t
}

fn scale_bilinear(src: &RgbaImage, w: u32, h: u32) -> RgbaImage {
    let mut out = blank(w, h, [0, 0, 0]);
    for y in 0..h {
        for x in 0..w {
            let fx = x as f32 * (src.width - 1) as f32 / (w - 1).max(1) as f32;
            let fy = y as f32 * (src.height - 1) as f32 / (h - 1).max(1) as f32;
            let x0 = fx.floor() as u32;
            let y0 = fy.floor() as u32;
            let x1 = (x0 + 1).min(src.width - 1);
            let y1 = (y0 + 1).min(src.height - 1);
            let tx = fx - x0 as f32;
            let ty = fy - y0 as f32;
            let c00 = get_pixel(src, x0, y0);
            let c10 = get_pixel(src, x1, y0);
            let c01 = get_pixel(src, x0, y1);
            let c11 = get_pixel(src, x1, y1);
            let mut rgb = [0u8; 3];
            for channel in 0..3 {
                let top = lerp(c00[channel], c10[channel], tx);
                let bottom = lerp(c01[channel], c11[channel], tx);
                rgb[channel] = (top + (bottom - top) * ty).round().clamp(0.0, 255.0) as u8;
            }
            put_pixel(&mut out, x, y, rgb);
        }
    }
    out
}

fn paste(dst: &mut RgbaImage, src: &RgbaImage, left: u32, top: u32) {
    for y in 0..src.height {
        for x in 0..src.width {
            put_pixel(dst, left + x, top + y, get_pixel(src, x, y));
        }
    }
}

#[test]
fn feature_matcher_finds_scaled_textured_icon() {
    let needle = draw_textured_icon(96, 72);
    let scaled = scale_bilinear(&needle, 120, 90);
    let mut haystack = blank(320, 240, [24, 28, 34]);
    paste(&mut haystack, &scaled, 90, 70);

    let opts = MatchOptions {
        confidence: 0.12,
        ..Default::default()
    };

    let found = FeatureMatcher.find(&haystack, &needle, &opts).unwrap();

    assert!(found.score >= opts.confidence);
    assert!((found.region.left - 90).abs() <= 12, "{:?}", found);
    assert!((found.region.top - 70).abs() <= 12, "{:?}", found);
    assert!((found.region.width - 120).abs() <= 18, "{:?}", found);
    assert!((found.region.height - 90).abs() <= 18, "{:?}", found);
}

#[test]
fn feature_matcher_rejects_low_texture_images() {
    let haystack = blank(240, 180, [32, 32, 32]);
    let needle = blank(80, 60, [32, 32, 32]);
    let opts = MatchOptions {
        confidence: 0.1,
        ..Default::default()
    };

    let err = FeatureMatcher.find(&haystack, &needle, &opts).unwrap_err();

    assert!(matches!(err, SpotterError::MatchNotFound { .. }));
}
