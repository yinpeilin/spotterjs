use crate::error::SpotterError;
use crate::types::{MatchOptions, Region, RgbaImage};
use napi::bindgen_prelude::*;

use super::types::{JsCaptureImage, JsMatchOptions, JsRegion};

pub fn region_to_js(r: Region) -> JsRegion {
    JsRegion {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
    }
}

pub fn region_from_js(r: &JsRegion) -> Region {
    Region {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
    }
}

pub fn match_opts_from_js(opts: Option<JsMatchOptions>) -> MatchOptions {
    match opts {
        Some(o) => MatchOptions {
            confidence: o.confidence.unwrap_or(0.9),
            search_region: o.search_region.as_ref().map(region_from_js),
            multi_scale: o.multi_scale.unwrap_or(false),
            scale_min: o.scale_min.unwrap_or(0.8),
            scale_max: o.scale_max.unwrap_or(1.2),
            scale_step: o.scale_step.unwrap_or(0.1),
        },
        None => MatchOptions::default(),
    }
}

pub fn capture_to_js(img: RgbaImage) -> JsCaptureImage {
    JsCaptureImage {
        width: img.width,
        height: img.height,
        data: Buffer::from(img.data),
    }
}

pub fn capture_from_js(img: &JsCaptureImage) -> Result<RgbaImage> {
    Ok(RgbaImage {
        width: img.width,
        height: img.height,
        data: img.data.to_vec(),
    })
}

pub fn map_err(e: SpotterError) -> Error {
    Error::from_reason(e.to_string())
}
