use spotter_base::{Result, RgbaImage, SpotterError};

#[cfg(feature = "parallel")]
use rayon::prelude::*;

const LUMA_R: f32 = 0.299;
const LUMA_G: f32 = 0.587;
const LUMA_B: f32 = 0.114;

/// Fixed-point luma weights (sum = 16384 ≈ 2^14).
const LUMA_RI: i32 = 4899;
const LUMA_GI: i32 = 9617;
const LUMA_BI: i32 = 1868;
const LUMA_SCALE: f32 = 1.0 / (16384.0 * 255.0);

pub fn rgba_to_gray(img: &RgbaImage) -> Result<Vec<f32>> {
    let expected = (img.width * img.height * 4) as usize;
    if img.data.len() != expected {
        return Err(SpotterError::Image("invalid RGBA buffer length".into()));
    }
    let w = img.width as usize;
    let h = img.height as usize;
    let mut gray = vec![0f32; w * h];
    let row_bytes = w * 4;

    #[cfg(feature = "parallel")]
    if w * h >= 512 * 512 {
        gray.par_chunks_mut(w)
            .enumerate()
            .for_each(|(y, row)| {
                rgba_row_to_gray(&img.data[y * row_bytes..(y + 1) * row_bytes], row);
            });
        return Ok(gray);
    }

    for y in 0..h {
        rgba_row_to_gray(
            &img.data[y * row_bytes..(y + 1) * row_bytes],
            &mut gray[y * w..(y + 1) * w],
        );
    }
    Ok(gray)
}

#[inline]
fn rgba_pixel_to_gray(px: &[u8]) -> f32 {
    (LUMA_R * px[0] as f32 + LUMA_G * px[1] as f32 + LUMA_B * px[2] as f32) / 255.0
}

fn rgba_row_to_gray(rgba: &[u8], out: &mut [f32]) {
    debug_assert_eq!(rgba.len(), out.len() * 4);
    let mut i = 0usize;
    let mut o = 0usize;
    while i + 32 <= rgba.len() {
        gray_chunk_8(&rgba[i..i + 32], &mut out[o..o + 8]);
        i += 32;
        o += 8;
    }
    while i + 4 <= rgba.len() {
        out[o] = rgba_pixel_to_gray(&rgba[i..i + 4]);
        i += 4;
        o += 1;
    }
}

#[inline]
fn gray_chunk_8(src: &[u8], dst: &mut [f32]) {
    debug_assert_eq!(src.len(), 32);
    debug_assert_eq!(dst.len(), 8);
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            unsafe {
                gray_chunk_8_avx2(src, dst);
                return;
            }
        }
    }
    for p in 0..8 {
        let s = p * 4;
        dst[p] = (src[s] as i32 * LUMA_RI + src[s + 1] as i32 * LUMA_GI + src[s + 2] as i32 * LUMA_BI)
            as f32
            * LUMA_SCALE;
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2")]
unsafe fn gray_chunk_8_avx2(src: &[u8], dst: &mut [f32]) {
    use std::arch::x86_64::*;
    let mut r = [0f32; 8];
    let mut g = [0f32; 8];
    let mut b = [0f32; 8];
    for p in 0..8 {
        let s = p * 4;
        r[p] = src[s] as f32;
        g[p] = src[s + 1] as f32;
        b[p] = src[s + 2] as f32;
    }
    let wr = _mm256_set1_ps(LUMA_R / 255.0);
    let wg = _mm256_set1_ps(LUMA_G / 255.0);
    let wb = _mm256_set1_ps(LUMA_B / 255.0);
    let mut luma = _mm256_mul_ps(_mm256_loadu_ps(r.as_ptr()), wr);
    luma = _mm256_fmadd_ps(_mm256_loadu_ps(g.as_ptr()), wg, luma);
    luma = _mm256_fmadd_ps(_mm256_loadu_ps(b.as_ptr()), wb, luma);
    _mm256_storeu_ps(dst.as_mut_ptr(), luma);
}

pub fn resize_gray(
    gray: &[f32],
    src_w: u32,
    src_h: u32,
    dst_w: u32,
    dst_h: u32,
) -> Result<Vec<f32>> {
    let expected = (src_w * src_h) as usize;
    if gray.len() != expected {
        return Err(SpotterError::Image("invalid gray buffer length".into()));
    }
    if src_w == 0 || src_h == 0 || dst_w == 0 || dst_h == 0 {
        return Err(SpotterError::Image("invalid gray resize dimensions".into()));
    }
    if src_w == dst_w && src_h == dst_h {
        return Ok(gray.to_vec());
    }
    let mid = resize_horizontal(gray, src_w, src_h, dst_w);
    Ok(resize_vertical(&mid, dst_w, src_h, dst_h))
}

#[inline]
fn remap_coord(dst_i: u32, dst_len: u32, src_len: u32) -> f64 {
    if dst_len <= 1 {
        return (src_len.saturating_sub(1) as f64) * 0.5;
    }
    (dst_i as f64 + 0.5) * src_len as f64 / dst_len as f64 - 0.5
}

#[inline]
fn sample_linear_1d(row: &[f32], src_len: u32, pos: f64) -> f32 {
    if src_len <= 1 {
        return row[0];
    }
    let max = (src_len - 1) as f64;
    let p = pos.clamp(0.0, max);
    let i0 = p.floor() as u32;
    let i1 = (i0 + 1).min(src_len - 1);
    let t = (p - i0 as f64) as f32;
    let a = row[i0 as usize];
    let b = row[i1 as usize];
    a + (b - a) * t
}

fn resize_horizontal(src: &[f32], src_w: u32, src_h: u32, dst_w: u32) -> Vec<f32> {
    if src_w == dst_w {
        return src.to_vec();
    }
    let src_w = src_w as usize;
    let dst_w = dst_w as usize;
    let mut out = vec![0f32; dst_w * src_h as usize];

    #[cfg(feature = "parallel")]
    {
        out.par_chunks_mut(dst_w)
            .enumerate()
            .for_each(|(y, dst_row)| {
                let src_row = &src[y * src_w..(y + 1) * src_w];
                for x in 0..dst_w {
                    let sx = remap_coord(x as u32, dst_w as u32, src_w as u32);
                    dst_row[x] = sample_linear_1d(src_row, src_w as u32, sx);
                }
            });
    }

    #[cfg(not(feature = "parallel"))]
    for y in 0..src_h as usize {
        let src_row = &src[y * src_w..(y + 1) * src_w];
        let dst_row = &mut out[y * dst_w..(y + 1) * dst_w];
        for x in 0..dst_w {
            let sx = remap_coord(x as u32, dst_w as u32, src_w as u32);
            dst_row[x] = sample_linear_1d(src_row, src_w as u32, sx);
        }
    }
    out
}

fn resize_vertical(mid: &[f32], mid_w: u32, src_h: u32, dst_h: u32) -> Vec<f32> {
    if src_h == dst_h {
        return mid.to_vec();
    }
    let mid_w = mid_w as usize;
    let dst_h = dst_h as usize;
    let src_h = src_h as usize;
    let mut out = vec![0f32; mid_w * dst_h];

    #[cfg(feature = "parallel")]
    {
        out.par_chunks_mut(mid_w)
            .enumerate()
            .for_each(|(y, dst_row)| {
                let sy = remap_coord(y as u32, dst_h as u32, src_h as u32);
                let i0 = sy.floor() as usize;
                let i1 = (i0 + 1).min(src_h - 1);
                let t = (sy - i0 as f64) as f32;
                for x in 0..mid_w {
                    let v0 = mid[i0 * mid_w + x];
                    let v1 = mid[i1 * mid_w + x];
                    dst_row[x] = v0 + (v1 - v0) * t;
                }
            });
    }

    #[cfg(not(feature = "parallel"))]
    for y in 0..dst_h {
        let sy = remap_coord(y as u32, dst_h as u32, src_h as u32);
        let i0 = sy.floor() as usize;
        let i1 = (i0 + 1).min(src_h - 1);
        let t = (sy - i0 as f64) as f32;
        let dst_row = &mut out[y * mid_w..(y + 1) * mid_w];
        for x in 0..mid_w {
            let v0 = mid[i0 * mid_w + x];
            let v1 = mid[i1 * mid_w + x];
            dst_row[x] = v0 + (v1 - v0) * t;
        }
    }
    out
}

pub fn scaled_dims(src_w: u32, src_h: u32, scale: f64) -> (u32, u32) {
    let nw = ((src_w as f64) * scale).round().max(4.0) as u32;
    let nh = ((src_h as f64) * scale).round().max(4.0) as u32;
    (nw, nh)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(w: u32, h: u32, rgb: [u8; 3]) -> RgbaImage {
        let mut data = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            data.extend_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
        }
        RgbaImage {
            width: w,
            height: h,
            data,
        }
    }

    #[test]
    fn gray_matches_scalar_reference() {
        let img = solid(64, 64, [100, 150, 200]);
        let gray = rgba_to_gray(&img).expect("gray");
        for (i, chunk) in img.data.chunks_exact(4).enumerate() {
            let expected = rgba_pixel_to_gray(chunk);
            assert!(
                (gray[i] - expected).abs() < 1e-5,
                "i={i} got={} expected={expected}",
                gray[i]
            );
        }
    }

    #[test]
    fn resize_preserves_flat_field() {
        let gray = vec![0.42f32; 32 * 32];
        let out = resize_gray(&gray, 32, 32, 24, 18).expect("resize");
        assert_eq!(out.len(), 24 * 18);
        for v in out {
            assert!((v - 0.42).abs() < 1e-4);
        }
    }

    #[test]
    fn resize_scales_dimensions() {
        let gray: Vec<f32> = (0..32 * 32)
            .map(|i| ((i % 17) as f32 / 16.0).sin())
            .collect();
        let out = resize_gray(&gray, 32, 32, 40, 36).expect("resize");
        assert_eq!(out.len(), 40 * 36);
        let min = out.iter().copied().fold(f32::INFINITY, f32::min);
        let max = out.iter().copied().fold(f32::NEG_INFINITY, f32::max);
        assert!(min >= -1.1 && max <= 1.1);
    }
}
