use spotterjs_base::{Result, RgbaImage, SpotterError};

pub fn validate_rgba(img: &RgbaImage, label: &str) -> Result<()> {
    let expected = img.width as usize * img.height as usize * 4;
    if img.width == 0 || img.height == 0 {
        return Err(SpotterError::Plugin(format!("{label} image has zero size")));
    }
    if img.data.len() != expected {
        return Err(SpotterError::Image(format!(
            "{label} image buffer has {} bytes, expected {expected}",
            img.data.len()
        )));
    }
    Ok(())
}

pub fn rgba_to_luma(img: &RgbaImage) -> Result<Vec<f32>> {
    validate_rgba(img, "rgba")?;
    let mut out = Vec::with_capacity((img.width * img.height) as usize);
    for px in img.data.chunks_exact(4) {
        out.push((0.299 * px[0] as f32 + 0.587 * px[1] as f32 + 0.114 * px[2] as f32) / 255.0);
    }
    Ok(out)
}
