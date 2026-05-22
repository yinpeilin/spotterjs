//! Cross-platform image decode (PNG, JPEG, WebP) via the `image` crate.

use spotterjs_base::{Result, RgbaImage, SpotterError};
use std::path::Path;

pub fn load_rgba_from_path(path: &Path) -> Result<RgbaImage> {
    let img = image::open(path).map_err(|e| SpotterError::Image(e.to_string()))?;
    rgba_from_dynamic(img)
}

pub fn load_rgba_from_bytes(bytes: &[u8]) -> Result<RgbaImage> {
    let img = image::load_from_memory(bytes).map_err(|e| SpotterError::Image(e.to_string()))?;
    rgba_from_dynamic(img)
}

pub fn image_size_from_path(path: &Path) -> Result<(u32, u32)> {
    let img = image::open(path).map_err(|e| SpotterError::Image(e.to_string()))?;
    Ok((img.width(), img.height()))
}

pub fn load_rgba_from_capture(width: u32, height: u32, data: &[u8]) -> Result<RgbaImage> {
    let expected = (width * height * 4) as usize;
    if data.len() != expected {
        return Err(SpotterError::Image(format!(
            "RGBA length mismatch: got {}, expected {expected}",
            data.len()
        )));
    }
    Ok(RgbaImage {
        width,
        height,
        data: data.to_vec(),
    })
}

fn rgba_from_dynamic(img: image::DynamicImage) -> Result<RgbaImage> {
    let rgba = img.to_rgba8();
    Ok(RgbaImage {
        width: rgba.width(),
        height: rgba.height(),
        data: rgba.into_raw(),
    })
}

pub fn encode_rgba_to_png(img: &RgbaImage) -> Result<Vec<u8>> {
    let rgba = image::RgbaImage::from_raw(img.width, img.height, img.data.clone())
        .ok_or_else(|| SpotterError::Image("invalid rgba buffer".into()))?;
    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    rgba.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| SpotterError::Image(e.to_string()))?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_rgba(w: u32, h: u32, fill: [u8; 3]) -> RgbaImage {
        let mut data = Vec::with_capacity((w * h * 4) as usize);
        for _ in 0..(w * h) {
            data.extend_from_slice(&[fill[0], fill[1], fill[2], 255]);
        }
        RgbaImage {
            width: w,
            height: h,
            data,
        }
    }

    #[test]
    fn encode_png_roundtrip() {
        let hay = solid_rgba(16, 16, [255, 0, 0]);
        let png = encode_rgba_to_png(&hay).expect("encode png");
        let loaded = load_rgba_from_bytes(&png).expect("decode png");
        assert_eq!(loaded.width, hay.width);
        assert_eq!(loaded.height, hay.height);
        assert_eq!(loaded.data, hay.data);
    }

    #[test]
    fn load_png_bytes_roundtrip() {
        let hay = solid_rgba(16, 16, [255, 0, 0]);
        let mut buf = Vec::new();
        let img = image::RgbaImage::from_raw(hay.width, hay.height, hay.data.clone()).unwrap();
        let mut cursor = std::io::Cursor::new(&mut buf);
        img.write_to(&mut cursor, image::ImageFormat::Png).unwrap();
        let loaded = load_rgba_from_bytes(&buf).expect("decode png");
        assert_eq!(loaded.width, hay.width);
        assert_eq!(loaded.height, hay.height);
        assert_eq!(loaded.data, hay.data);
    }

    #[test]
    fn load_jpeg_from_bytes() {
        let hay = solid_rgba(8, 8, [10, 20, 30]);
        let mut buf = Vec::new();
        let rgb = image::DynamicImage::ImageRgba8(
            image::RgbaImage::from_raw(hay.width, hay.height, hay.data.clone()).unwrap(),
        )
        .to_rgb8();
        let mut cursor = std::io::Cursor::new(&mut buf);
        rgb.write_to(&mut cursor, image::ImageFormat::Jpeg).unwrap();
        let loaded = load_rgba_from_bytes(&buf).expect("decode jpeg");
        assert_eq!(loaded.width, hay.width);
        assert_eq!(loaded.height, hay.height);
    }
}
