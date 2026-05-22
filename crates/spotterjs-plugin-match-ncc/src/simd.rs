//! SIMD helpers for f32 dot products (x86_64 AVX2 / aarch64 NEON, scalar fallback).

#[inline]
pub fn dot_f32(a: &[f32], b: &[f32]) -> f64 {
    debug_assert_eq!(a.len(), b.len());
    #[cfg(target_arch = "x86_64")]
    {
        if std::arch::is_x86_feature_detected!("avx2") {
            return unsafe { dot_f32_avx2(a, b) };
        }
        if std::arch::is_x86_feature_detected!("sse2") {
            return unsafe { dot_f32_sse2(a, b) };
        }
    }
    #[cfg(target_arch = "aarch64")]
    {
        return unsafe { dot_f32_neon(a, b) };
    }
    #[allow(unreachable_code)]
    dot_f32_scalar(a, b)
}

fn dot_f32_scalar(a: &[f32], b: &[f32]) -> f64 {
    a.iter().zip(b).map(|(&x, &y)| x as f64 * y as f64).sum()
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "avx2", enable = "fma")]
unsafe fn dot_f32_avx2(a: &[f32], b: &[f32]) -> f64 {
    use std::arch::x86_64::*;
    let len = a.len();
    let mut sum = _mm256_setzero_ps();
    let mut i = 0usize;
    while i + 8 <= len {
        let va = _mm256_loadu_ps(a.as_ptr().add(i));
        let vb = _mm256_loadu_ps(b.as_ptr().add(i));
        sum = _mm256_fmadd_ps(va, vb, sum);
        i += 8;
    }
    let mut buf = [0f32; 8];
    _mm256_storeu_ps(buf.as_mut_ptr(), sum);
    let mut total = buf.iter().map(|&v| v as f64).sum::<f64>();
    while i < len {
        total += a[i] as f64 * b[i] as f64;
        i += 1;
    }
    total
}

#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "sse2")]
unsafe fn dot_f32_sse2(a: &[f32], b: &[f32]) -> f64 {
    use std::arch::x86_64::*;
    let len = a.len();
    let mut sum = _mm_setzero_ps();
    let mut i = 0usize;
    while i + 4 <= len {
        let va = _mm_loadu_ps(a.as_ptr().add(i));
        let vb = _mm_loadu_ps(b.as_ptr().add(i));
        sum = _mm_add_ps(sum, _mm_mul_ps(va, vb));
        i += 4;
    }
    let mut buf = [0f32; 4];
    _mm_storeu_ps(buf.as_mut_ptr(), sum);
    let mut total = buf.iter().map(|&v| v as f64).sum::<f64>();
    while i < len {
        total += a[i] as f64 * b[i] as f64;
        i += 1;
    }
    total
}

#[cfg(target_arch = "aarch64")]
#[target_feature(enable = "neon")]
unsafe fn dot_f32_neon(a: &[f32], b: &[f32]) -> f64 {
    use std::arch::aarch64::*;
    let len = a.len();
    let mut sum = vdupq_n_f32(0.0);
    let mut i = 0usize;
    while i + 4 <= len {
        let va = vld1q_f32(a.as_ptr().add(i));
        let vb = vld1q_f32(b.as_ptr().add(i));
        sum = vfmaq_f32(sum, va, vb);
        i += 4;
    }
    let mut total = vaddvq_f32(sum) as f64;
    while i < len {
        total += a[i] as f64 * b[i] as f64;
        i += 1;
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dot_matches_scalar() {
        let a: Vec<f32> = (0..64).map(|i| (i as f32 * 0.01).sin()).collect();
        let b: Vec<f32> = (0..64).map(|i| (i as f32 * 0.02).cos()).collect();
        let scalar = dot_f32_scalar(&a, &b);
        let simd = dot_f32(&a, &b);
        assert!((scalar - simd).abs() < 1e-4, "scalar={scalar} simd={simd}");
    }
}
