//! BGRA → RGBA conversion (SIMD when available).

#[cfg(test)]
pub fn bgra_to_rgba(src: &[u8], dst: &mut [u8]) {
    debug_assert_eq!(src.len(), dst.len());
    bgra_to_rgba_impl(src, dst);
}

/// In-place channel swap (B,G,R,A → R,G,B,A).
pub fn bgra_to_rgba_inplace(buf: &mut [u8]) {
    debug_assert_eq!(buf.len() % 4, 0);
    let len = buf.len();
    let mut i = 0usize;
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("ssse3") {
            let end = len.saturating_sub(63);
            while i < end {
                unsafe {
                    bgra_to_rgba_ssse3_chunk(buf[i..i + 64].as_ptr(), buf.as_mut_ptr().add(i));
                }
                i += 64;
            }
        }
    }
    while i + 4 <= len {
        let b = buf[i];
        let g = buf[i + 1];
        let r = buf[i + 2];
        let a = buf[i + 3];
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = a;
        i += 4;
    }
}

#[cfg(test)]
fn bgra_to_rgba_impl(src: &[u8], dst: &mut [u8]) {
    debug_assert_eq!(src.len(), dst.len());
    debug_assert_eq!(src.len() % 4, 0);
    let mut i = 0usize;
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("ssse3") {
            let end = src.len().saturating_sub(63);
            while i < end {
                unsafe {
                    bgra_to_rgba_ssse3_chunk(src[i..i + 64].as_ptr(), dst.as_mut_ptr().add(i));
                }
                i += 64;
            }
        }
    }
    while i + 4 <= src.len() {
        let s = &src[i..i + 4];
        dst[i] = s[2];
        dst[i + 1] = s[1];
        dst[i + 2] = s[0];
        dst[i + 3] = s[3];
        i += 4;
    }
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "ssse3")]
unsafe fn bgra_to_rgba_ssse3_chunk(src: *const u8, dst: *mut u8) {
    use std::arch::x86_64::*;
    let shuffle = _mm_setr_epi8(
        2, 1, 0, 3, 6, 5, 4, 7, 10, 9, 8, 11, 14, 13, 12, 15,
    );
    let mut off = 0usize;
    while off + 16 <= 64 {
        let chunk = _mm_loadu_si128(src.add(off) as *const __m128i);
        _mm_storeu_si128(dst.add(off) as *mut __m128i, _mm_shuffle_epi8(chunk, shuffle));
        off += 16;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn swaps_channels() {
        let src = [0u8, 1, 2, 3, 4, 5, 6, 7];
        let mut dst = [0u8; 8];
        bgra_to_rgba(&src, &mut dst);
        assert_eq!(dst, [2, 1, 0, 3, 6, 5, 4, 7]);
    }

    #[test]
    fn inplace_matches_copy() {
        let mut buf = [0u8, 1, 2, 3, 4, 5, 6, 7];
        let mut expected = [0u8; 8];
        bgra_to_rgba(&buf, &mut expected);
        bgra_to_rgba_inplace(&mut buf);
        assert_eq!(buf, expected);
    }
}
