use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi(object)]
pub struct JsRegion {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

#[napi(object)]
pub struct JsMatchResult {
    pub region: JsRegion,
    pub score: f64,
}

#[napi(object)]
pub struct JsCaptureImage {
    pub data: Buffer,
    pub width: u32,
    pub height: u32,
}

#[napi(object)]
pub struct JsMatchOptions {
    pub confidence: Option<f64>,
    pub search_region: Option<JsRegion>,
    pub multi_scale: Option<bool>,
    pub scale_min: Option<f64>,
    pub scale_max: Option<f64>,
    pub scale_step: Option<f64>,
}
