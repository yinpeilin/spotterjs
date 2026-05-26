#[cfg(feature = "parallel")]
use rayon::prelude::*;

use spotterjs_base::{MatchOptions, Region, Result, RgbaImage, SpotterError};

use crate::integral::IntegralImage;
use crate::ncc::{scan_row_best, search_bounds, validate_search_region, PreparedNeedle};

#[cfg(feature = "parallel")]
pub fn find_best_parallel(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
) -> Result<(Region, f64)> {
    validate_search_region(opts)?;
    let hay_w = haystack.width;
    let hay_h = haystack.height;
    let (x0, y0, x1, y1) = search_bounds(hay_w, hay_h, needle.nw, needle.nh, opts);

    if x1 < x0 + needle.nw || y1 < y0 + needle.nh {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    let integral = IntegralImage::from_gray(hay, hay_w, hay_h);
    let y_end = y1 - needle.nh;

    let best = (y0..=y_end)
        .into_par_iter()
        .map(|oy| {
            let (score, ox) = scan_row_best(hay, hay_w, &integral, needle, oy, x0, x1);
            (score, (ox, oy))
        })
        .reduce(
            || (f64::MIN, (0u32, 0u32)),
            |a, b| {
                if b.0 > a.0 {
                    b
                } else {
                    a
                }
            },
        );

    let (best_score, best_xy) = best;
    if best_score < opts.confidence {
        return Err(SpotterError::MatchNotFound {
            confidence: opts.confidence,
        });
    }

    Ok((
        Region {
            left: best_xy.0 as i32,
            top: best_xy.1 as i32,
            width: needle.nw as i32,
            height: needle.nh as i32,
        },
        best_score,
    ))
}
