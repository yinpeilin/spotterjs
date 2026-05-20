#![deny(clippy::all)]

use napi_derive::napi;
use spotter_base::napi::{
    capture_from_js, capture_to_js, map_err, match_opts_from_js, region_to_js, JsCaptureImage,
    JsMatchOptions, JsRegion,
};
use spotter_base::{MatchPlugin, RgbaImage};
use spotter_plugin_match_opencv::{load_rgba_from_path, OpenCvMatcher};
use std::path::Path;

static OPENCV: OpenCvMatcher = OpenCvMatcher;

fn resolve_needle(path: &str, buffer: Option<napi::bindgen_prelude::Buffer>) -> napi::Result<RgbaImage> {
    if let Some(buf) = buffer {
        let data = buf.to_vec();
        let img = image::load_from_memory(&data).map_err(|e| map_err(spotter_base::SpotterError::Image(e.to_string())))?;
        let rgba = img.to_rgba8();
        return Ok(RgbaImage {
            width: rgba.width(),
            height: rgba.height(),
            data: rgba.into_raw(),
        });
    }
    load_rgba_from_path(Path::new(path)).map_err(map_err)
}

#[napi]
pub fn matcher_name() -> String {
    OPENCV.name().to_string()
}

#[napi]
pub fn find_template(
    haystack: JsCaptureImage,
    needle_path: String,
    needle_buffer: Option<napi::bindgen_prelude::Buffer>,
    opts: Option<JsMatchOptions>,
) -> napi::Result<JsRegion> {
    let hay = capture_from_js(&haystack).map_err(map_err)?;
    let needle = resolve_needle(&needle_path, needle_buffer)?;
    let opts = match_opts_from_js(opts);
    OPENCV
        .find(&hay, &needle, &opts)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn find_all_templates(
    haystack: JsCaptureImage,
    needle_path: String,
    needle_buffer: Option<napi::bindgen_prelude::Buffer>,
    opts: Option<JsMatchOptions>,
) -> napi::Result<Vec<JsRegion>> {
    let hay = capture_from_js(&haystack).map_err(map_err)?;
    let needle = resolve_needle(&needle_path, needle_buffer)?;
    let opts = match_opts_from_js(opts);
    OPENCV
        .find_all(&hay, &needle, &opts)
        .map(|v| v.into_iter().map(region_to_js).collect())
        .map_err(map_err)
}

#[napi]
pub fn find_template_buffers(
    haystack: JsCaptureImage,
    needle: JsCaptureImage,
    opts: Option<JsMatchOptions>,
) -> napi::Result<JsRegion> {
    let hay = capture_from_js(&haystack).map_err(map_err)?;
    let needle = capture_from_js(&needle).map_err(map_err)?;
    let opts = match_opts_from_js(opts);
    OPENCV
        .find(&hay, &needle, &opts)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn rgba_from_path(path: String) -> napi::Result<JsCaptureImage> {
    load_rgba_from_path(Path::new(&path))
        .map(capture_to_js)
        .map_err(map_err)
}
