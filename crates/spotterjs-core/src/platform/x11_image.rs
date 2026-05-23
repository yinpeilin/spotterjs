use crate::error::{Result, SpotterError};

/// Convert X11 ZPixmap bytes to RGBA (BGRX/BGRA channel order for 24/32-bit).
pub fn pixels_to_rgba(depth: u8, src: &[u8], width: u32, height: u32) -> Result<Vec<u8>> {
    let bpp = match depth {
        24 | 32 => 4,
        16 => 2,
        8 => 1,
        _ => {
            return Err(SpotterError::CaptureFailed(format!(
                "unsupported depth {depth}"
            )))
        }
    };
    let mut out = vec![0u8; (width * height * 4) as usize];
    for y in 0..height {
        for x in 0..width {
            let si = ((y * width + x) * bpp) as usize;
            let di = ((y * width + x) * 4) as usize;
            if si + bpp as usize > src.len() || di + 4 > out.len() {
                continue;
            }
            match bpp {
                4 => {
                    out[di] = src[si + 2];
                    out[di + 1] = src[si + 1];
                    out[di + 2] = src[si];
                    out[di + 3] = 255;
                }
                _ => {
                    let v = src[si];
                    out[di] = v;
                    out[di + 1] = v;
                    out[di + 2] = v;
                    out[di + 3] = 255;
                }
            }
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn depth_24_converts_bgrx_to_rgba() {
        // Two pixels: blue (B=255) then red (R=255) in BGRX layout
        let src = vec![
            255, 0, 0, 0, // pixel 0: BGRX -> blue in RGBA is R=0,G=0,B=255
            0, 0, 255, 0, // pixel 1: BGRX -> red
        ];
        let out = pixels_to_rgba(24, &src, 2, 1).unwrap();
        assert_eq!(&out[0..4], &[0, 0, 255, 255]);
        assert_eq!(&out[4..8], &[255, 0, 0, 255]);
    }

    #[test]
    fn unsupported_depth_errors() {
        let err = pixels_to_rgba(15, &[], 1, 1).unwrap_err();
        assert!(matches!(err, SpotterError::CaptureFailed(_)));
    }

    #[test]
    fn skips_out_of_bounds_source() {
        let src = vec![0, 0, 255, 0]; // one pixel only
        let out = pixels_to_rgba(24, &src, 2, 1).unwrap();
        assert_eq!(&out[0..4], &[255, 0, 0, 255]);
        assert_eq!(&out[4..8], &[0, 0, 0, 0]);
    }
}
