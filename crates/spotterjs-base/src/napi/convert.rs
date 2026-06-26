use crate::error::SpotterError;
use crate::types::{MatchBackend, MatchOptions, MatchResult, Region, Rgb, RgbaImage};
use napi::bindgen_prelude::*;

use super::types::{JsCaptureImage, JsMatchOptions, JsMatchResult, JsRegion, JsRgb};

pub fn region_to_js(r: Region) -> JsRegion {
    JsRegion {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
    }
}

pub fn match_result_to_js(m: MatchResult) -> JsMatchResult {
    JsMatchResult {
        region: region_to_js(m.region),
        score: m.score,
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
            backend: o
                .backend
                .as_deref()
                .and_then(MatchBackend::from_name)
                .unwrap_or(MatchBackend::Ncc),
        },
        None => MatchOptions::default(),
    }
}

pub fn rgb_to_js(rgb: Rgb) -> JsRgb {
    JsRgb {
        r: rgb.r as u32,
        g: rgb.g as u32,
        b: rgb.b as u32,
    }
}

pub fn rgb_from_js(rgb: &JsRgb) -> Rgb {
    Rgb {
        r: rgb.r.min(255) as u8,
        g: rgb.g.min(255) as u8,
        b: rgb.b.min(255) as u8,
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
    Error::new(Status::GenericFailure, e.to_napi_message())
}
