//! Summed-area tables for O(1) window mean / variance queries.

pub struct IntegralImage {
    stride: u32,
    sum: Vec<f64>,
    sum_sq: Vec<f64>,
}

impl IntegralImage {
    pub fn from_gray(gray: &[f32], w: u32, h: u32) -> Self {
        let stride = w + 1;
        let len = ((h + 1) * stride) as usize;
        let mut sum = vec![0.0; len];
        let mut sum_sq = vec![0.0; len];
        let stride_usize = stride as usize;

        for y in 0..h {
            let row_base = (y * w) as usize;
            let table_y = (y + 1) * stride;
            for x in 0..w {
                let v = gray[row_base + x as usize] as f64;
                let idx = (table_y + (x + 1)) as usize;
                let above = idx - stride_usize;
                let left = idx - 1;
                sum[idx] = v + sum[left] + sum[above] - sum[above - 1];
                sum_sq[idx] = v * v + sum_sq[left] + sum_sq[above] - sum_sq[above - 1];
            }
        }

        Self {
            stride,
            sum,
            sum_sq,
        }
    }

    #[inline]
    fn at(&self, x: u32, y: u32) -> (f64, f64) {
        let idx = (y * self.stride + x) as usize;
        (self.sum[idx], self.sum_sq[idx])
    }

    /// Sum over `[x0, x1) × [y0, y1)`.
    #[inline]
    pub fn rect_stats(&self, x0: u32, y0: u32, x1: u32, y1: u32) -> (f64, f64) {
        let (a, a2) = self.at(x1, y1);
        let (b, b2) = self.at(x0, y1);
        let (c, c2) = self.at(x1, y0);
        let (d, d2) = self.at(x0, y0);
        (a - b - c + d, a2 - b2 - c2 + d2)
    }
}
