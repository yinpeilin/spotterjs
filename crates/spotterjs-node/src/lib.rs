#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use spotterjs_base::napi::{
    capture_from_js, capture_to_js, map_err, match_opts_from_js, match_result_to_js,
    region_from_js, region_to_js, JsCaptureImage, JsMatchOptions, JsMatchResult, JsRegion,
};
use spotterjs_core::{
    a11y_attach_active, a11y_attach_window, a11y_attach_window_report, a11y_disable,
    a11y_dump_tree, a11y_dump_tree_node, a11y_enable, a11y_find_descendant, a11y_get_bounds,
    a11y_get_element_info, a11y_invoke, a11y_refresh_root, a11y_set_value, a11y_tree_health,
    a11y_wait_for_descendant, check_tree_health, clipboard_get, clipboard_set, find_apps,
    find_windows, format_element_id, get_foreground_app, is_accessibility_enabled, keyboard_press,
    keyboard_release, keyboard_type, keyboard_type_keys, list_desktop_apps, minimize_window,
    mouse_click, mouse_drag_to, mouse_get_position, mouse_move, move_window, parse_element_id,
    parse_key, parse_keys, parse_window_id, resize_window, restore_window, screen_height,
    screen_size, screen_width, set_keyboard_config, set_mouse_config, straight_line_points,
    wait_for_window, A11yBounds, A11yConfig, A11yElementId, A11yQuery, AttachReport, DesktopApp,
    ElementInfo, KeyboardConfig, MouseButton, MouseConfig, Point, TreeHealth, TreeNodeDump,
    TreeViewMode, WindowInfo, VERSION,
};
use std::path::Path;

#[napi(object)]
pub struct JsPoint {
    pub x: i32,
    pub y: i32,
}

#[napi(object)]
pub struct JsWindowInfo {
    pub id: String,
    pub id_hex: String,
    pub title: String,
    pub region: JsRegion,
    pub process_id: u32,
    pub process_name: String,
    pub exe_path: Option<String>,
    pub is_minimized: bool,
    pub is_foreground: bool,
}

#[napi(object)]
pub struct JsDesktopApp {
    pub process_id: u32,
    pub process_name: String,
    pub exe_path: Option<String>,
    pub windows: Vec<JsWindowInfo>,
    pub is_foreground: bool,
}

#[napi(object)]
pub struct JsScreenSize {
    pub width: i32,
    pub height: i32,
}

#[napi(object)]
pub struct JsMouseConfig {
    pub auto_delay_ms: Option<u32>,
    pub mouse_speed: Option<u32>,
}

#[napi(object)]
pub struct JsKeyboardConfig {
    pub auto_delay_ms: Option<u32>,
}

fn window_to_js(w: WindowInfo) -> JsWindowInfo {
    JsWindowInfo {
        id: w.id.0.to_string(),
        id_hex: w.id.to_hex(),
        title: w.title,
        region: region_to_js(w.region),
        process_id: w.process_id,
        process_name: w.process_name,
        exe_path: w.exe_path,
        is_minimized: w.is_minimized,
        is_foreground: w.is_foreground,
    }
}

fn desktop_app_to_js(a: DesktopApp) -> JsDesktopApp {
    JsDesktopApp {
        process_id: a.process_id,
        process_name: a.process_name,
        exe_path: a.exe_path,
        windows: a.windows.into_iter().map(window_to_js).collect(),
        is_foreground: a.is_foreground,
    }
}

fn mouse_button_from_str(button: Option<&str>) -> MouseButton {
    match button {
        Some("right") => MouseButton::Right,
        Some("middle") => MouseButton::Middle,
        _ => MouseButton::Left,
    }
}

#[napi]
pub fn version() -> String {
    VERSION.to_string()
}

// --- Screen ---

#[napi]
pub fn get_screen_size() -> Result<JsScreenSize> {
    let (w, h) = screen_size().map_err(map_err)?;
    Ok(JsScreenSize {
        width: w,
        height: h,
    })
}

#[napi]
pub fn get_screen_width() -> Result<i32> {
    screen_width().map_err(map_err)
}

#[napi]
pub fn get_screen_height() -> Result<i32> {
    screen_height().map_err(map_err)
}

#[napi]
pub fn capture_screen(region: Option<JsRegion>) -> Result<JsCaptureImage> {
    let reg = region.as_ref().map(region_from_js);
    spotterjs_core::capture_screen(reg)
        .map(capture_to_js)
        .map_err(map_err)
}

#[napi]
pub fn capture_window(id: String) -> Result<JsCaptureImage> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotterjs_core::capture_window(wid)
        .map(capture_to_js)
        .map_err(map_err)
}

#[napi(object)]
pub struct JsImageSize {
    pub width: u32,
    pub height: u32,
}

#[napi(js_name = "loadImageFromPath")]
pub fn load_image_from_path(path: String) -> Result<JsCaptureImage> {
    let img = spotterjs_core::load_rgba_from_path(Path::new(&path)).map_err(map_err)?;
    Ok(capture_to_js(img))
}

#[napi(js_name = "loadImageFromBuffer")]
pub fn load_image_from_buffer(bytes: Buffer) -> Result<JsCaptureImage> {
    let img = spotterjs_core::load_rgba_from_bytes(bytes.as_ref()).map_err(map_err)?;
    Ok(capture_to_js(img))
}

#[napi(js_name = "getImageSize")]
pub fn get_image_size(path: String) -> Result<JsImageSize> {
    let (w, h) = spotterjs_core::image_size_from_path(Path::new(&path)).map_err(map_err)?;
    Ok(JsImageSize {
        width: w,
        height: h,
    })
}

#[napi(js_name = "encodeCapturePng")]
pub fn encode_capture_png(capture: JsCaptureImage) -> Result<Buffer> {
    let img = capture_from_js(&capture)?;
    let png = spotterjs_core::encode_rgba_to_png(&img).map_err(map_err)?;
    Ok(Buffer::from(png))
}

#[napi(js_name = "encodeCapturePngBase64")]
pub fn encode_capture_png_base64(capture: JsCaptureImage) -> Result<String> {
    let img = capture_from_js(&capture)?;
    let png = spotterjs_core::encode_rgba_to_png(&img).map_err(map_err)?;
    Ok(base64_encode(&png))
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

// --- Window ---

#[napi]
pub fn list_windows() -> Result<Vec<JsWindowInfo>> {
    spotterjs_core::list_windows()
        .map(|v| v.into_iter().map(window_to_js).collect())
        .map_err(map_err)
}

#[napi]
pub fn get_active_window() -> Result<JsWindowInfo> {
    spotterjs_core::get_active_window()
        .map(window_to_js)
        .map_err(map_err)
}

#[napi]
pub fn focus_window(id: String) -> Result<bool> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotterjs_core::focus_window(wid)
        .map(|_| true)
        .map_err(map_err)
}

#[napi]
pub fn get_window_region(id: String) -> Result<JsRegion> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotterjs_core::get_window_region(wid)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn get_window_region_clamped(id: String) -> Result<JsRegion> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotterjs_core::get_window_region_clamped(wid)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn get_window_client_origin(id: String) -> Result<JsPoint> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    let (x, y) = spotterjs_core::get_window_client_origin(wid).map_err(map_err)?;
    Ok(JsPoint { x, y })
}

#[napi(js_name = "moveWindow")]
pub fn move_window_js(id: String, x: i32, y: i32) -> Result<()> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    move_window(wid, x, y).map_err(map_err)
}

#[napi(js_name = "resizeWindow")]
pub fn resize_window_js(id: String, width: i32, height: i32) -> Result<()> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    resize_window(wid, width, height).map_err(map_err)
}

#[napi(js_name = "minimizeWindow")]
pub fn minimize_window_js(id: String) -> Result<()> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    minimize_window(wid).map_err(map_err)
}

#[napi(js_name = "restoreWindow")]
pub fn restore_window_js(id: String) -> Result<()> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    restore_window(wid).map_err(map_err)
}

// --- Desktop apps ---

#[napi(js_name = "listDesktopApps")]
pub fn list_desktop_apps_js() -> Result<Vec<JsDesktopApp>> {
    list_desktop_apps()
        .map(|v| v.into_iter().map(desktop_app_to_js).collect())
        .map_err(map_err)
}

#[napi(js_name = "findDesktopApps")]
pub fn find_desktop_apps(substring: String) -> Result<Vec<JsDesktopApp>> {
    find_apps(&substring)
        .map(|v| v.into_iter().map(desktop_app_to_js).collect())
        .map_err(map_err)
}

#[napi(js_name = "findWindowsByTitle")]
pub fn find_windows_by_title(substring: String) -> Result<Vec<JsWindowInfo>> {
    find_windows(&substring)
        .map(|v| v.into_iter().map(window_to_js).collect())
        .map_err(map_err)
}

#[napi(js_name = "waitForWindowByTitle")]
pub fn wait_for_window_by_title(
    substring: String,
    timeout_ms: u32,
    poll_ms: Option<u32>,
) -> Result<JsWindowInfo> {
    wait_for_window(&substring, timeout_ms as u64, poll_ms.unwrap_or(200) as u64)
        .map(window_to_js)
        .map_err(map_err)
}

#[napi(js_name = "getForegroundApp")]
pub fn get_foreground_app_js() -> Result<JsDesktopApp> {
    get_foreground_app().map(desktop_app_to_js).map_err(map_err)
}

// --- Matcher ---

#[napi]
pub fn find_template(
    path: String,
    needle_buffer: Option<Buffer>,
    opts: Option<JsMatchOptions>,
) -> Result<JsMatchResult> {
    let bytes = needle_buffer.as_ref().map(|b| b.as_ref());
    spotterjs_core::find_template_with_needle(Path::new(&path), bytes, match_opts_from_js(opts))
        .map(match_result_to_js)
        .map_err(map_err)
}

#[napi]
pub fn find_all_templates(
    path: String,
    needle_buffer: Option<Buffer>,
    opts: Option<JsMatchOptions>,
) -> Result<Vec<JsMatchResult>> {
    let bytes = needle_buffer.as_ref().map(|b| b.as_ref());
    spotterjs_core::find_all_templates_with_needle(
        Path::new(&path),
        bytes,
        match_opts_from_js(opts),
    )
    .map(|v| v.into_iter().map(match_result_to_js).collect())
    .map_err(map_err)
}

#[napi]
pub fn find_template_in_window(
    id: String,
    path: String,
    needle_buffer: Option<Buffer>,
    opts: Option<JsMatchOptions>,
) -> Result<JsMatchResult> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    let bytes = needle_buffer.as_ref().map(|b| b.as_ref());
    spotterjs_core::find_template_in_window_with_needle(
        wid,
        Path::new(&path),
        bytes,
        match_opts_from_js(opts),
    )
    .map(match_result_to_js)
    .map_err(map_err)
}

#[napi]
pub fn find_all_templates_in_window(
    id: String,
    path: String,
    needle_buffer: Option<Buffer>,
    opts: Option<JsMatchOptions>,
) -> Result<Vec<JsMatchResult>> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    let bytes = needle_buffer.as_ref().map(|b| b.as_ref());
    spotterjs_core::find_all_templates_in_window_with_needle(
        wid,
        Path::new(&path),
        bytes,
        match_opts_from_js(opts),
    )
    .map(|v| v.into_iter().map(match_result_to_js).collect())
    .map_err(map_err)
}

#[napi]
pub fn wait_for_template(
    path: String,
    needle_buffer: Option<Buffer>,
    timeout_ms: u32,
    opts: Option<JsMatchOptions>,
    interval_ms: Option<u32>,
) -> Result<JsMatchResult> {
    let bytes = needle_buffer.as_ref().map(|b| b.as_ref());
    spotterjs_core::wait_for_template_with_needle(
        Path::new(&path),
        bytes,
        timeout_ms as u64,
        match_opts_from_js(opts),
        interval_ms.map(|v| v as u64),
    )
    .map(match_result_to_js)
    .map_err(map_err)
}

#[napi(js_name = "findTemplateBuffers")]
pub fn find_template_buffers(
    haystack: JsCaptureImage,
    needle: JsCaptureImage,
    opts: Option<JsMatchOptions>,
) -> Result<JsMatchResult> {
    let hay = capture_from_js(&haystack)?;
    let needle = capture_from_js(&needle)?;
    spotterjs_core::find_template_buffers(&hay, &needle, &match_opts_from_js(opts))
        .map(match_result_to_js)
        .map_err(map_err)
}

#[napi(js_name = "findAllTemplateBuffers")]
pub fn find_all_template_buffers(
    haystack: JsCaptureImage,
    needle: JsCaptureImage,
    opts: Option<JsMatchOptions>,
) -> Result<Vec<JsMatchResult>> {
    let hay = capture_from_js(&haystack)?;
    let needle = capture_from_js(&needle)?;
    spotterjs_core::find_all_template_buffers(&hay, &needle, &match_opts_from_js(opts))
        .map(|v| v.into_iter().map(match_result_to_js).collect())
        .map_err(map_err)
}

#[napi(js_name = "waitForTemplateBuffers")]
pub fn wait_for_template_buffers(
    haystack: JsCaptureImage,
    needle: JsCaptureImage,
    timeout_ms: u32,
    opts: Option<JsMatchOptions>,
    interval_ms: Option<u32>,
) -> Result<JsMatchResult> {
    let hay = capture_from_js(&haystack)?;
    let needle = capture_from_js(&needle)?;
    spotterjs_core::wait_for_template_buffers(
        &hay,
        &needle,
        timeout_ms as u64,
        match_opts_from_js(opts),
        interval_ms.map(|v| v as u64),
    )
    .map(match_result_to_js)
    .map_err(map_err)
}

// --- Mouse ---

#[napi(js_name = "setMouseConfig")]
pub fn set_mouse_config_js(config: JsMouseConfig) -> Result<()> {
    let mut cfg = MouseConfig::default();
    if let Some(ms) = config.auto_delay_ms {
        cfg.auto_delay_ms = ms as u64;
    }
    if let Some(speed) = config.mouse_speed {
        cfg.mouse_speed = speed;
    }
    set_mouse_config(cfg);
    Ok(())
}

#[napi]
pub fn get_position() -> Result<JsPoint> {
    let (x, y) = mouse_get_position().map_err(map_err)?;
    Ok(JsPoint { x, y })
}

#[napi(js_name = "mouseMove")]
pub fn mouse_move_js(x: i32, y: i32) -> Result<()> {
    mouse_move(x, y).map_err(map_err)
}

#[napi]
pub fn mouse_move_path(points: Vec<JsPoint>) -> Result<()> {
    let pts: Vec<(i32, i32)> = points.iter().map(|p| (p.x, p.y)).collect();
    spotterjs_core::mouse_move_path(&pts).map_err(map_err)
}

#[napi]
pub fn mouse_move_straight(x: i32, y: i32) -> Result<()> {
    let (cx, cy) = mouse_get_position().map_err(map_err)?;
    let line = straight_line_points(Point { x: cx, y: cy }, Point { x, y }, 5);
    spotterjs_core::mouse_move_path(&line.iter().map(|p| (p.x, p.y)).collect::<Vec<_>>())
        .map_err(map_err)
}

#[napi(js_name = "mouseClick")]
pub fn mouse_click_js(button: Option<String>) -> Result<()> {
    mouse_click(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_double_click(button: Option<String>) -> Result<()> {
    spotterjs_core::mouse_double_click(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_press(button: Option<String>) -> Result<()> {
    spotterjs_core::mouse_press(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_release(button: Option<String>) -> Result<()> {
    spotterjs_core::mouse_release(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_drag(x: i32, y: i32, button: Option<String>) -> Result<()> {
    mouse_drag_to(x, y, mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_up(amount: i32) -> Result<()> {
    spotterjs_core::mouse_scroll_up(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_down(amount: i32) -> Result<()> {
    spotterjs_core::mouse_scroll_down(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_left(amount: i32) -> Result<()> {
    spotterjs_core::mouse_scroll_left(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_right(amount: i32) -> Result<()> {
    spotterjs_core::mouse_scroll_right(amount).map_err(map_err)
}

#[napi]
pub fn tap_at(x: i32, y: i32, button: Option<String>) -> Result<()> {
    spotterjs_core::tap_at(x, y, mouse_button_from_str(button.as_deref())).map_err(map_err)
}

// --- Keyboard ---

#[napi(js_name = "setKeyboardConfig")]
pub fn set_keyboard_config_js(config: JsKeyboardConfig) -> Result<()> {
    let mut cfg = KeyboardConfig::default();
    if let Some(ms) = config.auto_delay_ms {
        cfg.auto_delay_ms = ms as u64;
    }
    set_keyboard_config(cfg);
    Ok(())
}

#[napi]
pub fn keyboard_type_text(text: String) -> Result<()> {
    keyboard_type(&text).map_err(map_err)
}

#[napi]
pub fn keyboard_press_keys(keys: Vec<String>) -> Result<()> {
    let parsed = parse_keys(&keys).map_err(map_err)?;
    keyboard_press(&parsed).map_err(map_err)
}

#[napi]
pub fn keyboard_release_keys(keys: Vec<String>) -> Result<()> {
    let parsed = parse_keys(&keys).map_err(map_err)?;
    keyboard_release(&parsed).map_err(map_err)
}

#[napi]
pub fn keyboard_type_key(key: String) -> Result<()> {
    let k = parse_key(&key).map_err(map_err)?;
    keyboard_type_keys(&[k]).map_err(map_err)
}

#[napi]
pub fn keyboard_shortcut(keys: Vec<String>) -> Result<()> {
    let parsed = parse_keys(&keys).map_err(map_err)?;
    keyboard_type_keys(&parsed).map_err(map_err)
}

// --- Clipboard ---

#[napi(js_name = "clipboardSet")]
pub fn clipboard_set_js(text: String) -> Result<()> {
    clipboard_set(&text).map_err(map_err)
}

#[napi(js_name = "clipboardGet")]
pub fn clipboard_get_js() -> Result<String> {
    clipboard_get().map_err(map_err)
}

// --- Accessibility ---

#[napi(object)]
pub struct JsA11yConfig {
    pub attach_delay_ms: Option<u32>,
    pub event_subscription: Option<bool>,
    pub tree_wait_timeout_ms: Option<u32>,
    pub tree_wait_poll_ms: Option<u32>,
    pub min_list_item_count: Option<u32>,
    pub tree_view: Option<String>,
}

#[napi(object)]
pub struct JsAttachCandidate {
    pub hwnd: String,
    pub class_name: String,
    pub total_nodes: u32,
    pub list_item_count: u32,
    pub edit_count: u32,
    pub chosen: bool,
}

#[napi(object)]
pub struct JsAttachReport {
    pub element_id: String,
    pub client_mode: bool,
    pub event_handler_registered: bool,
    pub structure_changed_events: u32,
    pub health_initial: JsTreeHealth,
    pub health_final: JsTreeHealth,
    pub tree_wait_ms: u32,
    pub attach_strategy: String,
    pub attached_hwnd: String,
    pub tree_view: String,
    pub candidates: Vec<JsAttachCandidate>,
    pub diagnosis: Vec<String>,
}

#[napi(object)]
pub struct JsA11yBounds {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}

#[napi(object)]
pub struct JsElementInfo {
    pub name: String,
    pub control_type: String,
    pub automation_id: String,
    pub class_name: String,
    pub framework_id: String,
    pub runtime_id: String,
    pub is_offscreen: bool,
    pub patterns: Vec<String>,
    pub bounds: Option<JsA11yBounds>,
}

#[napi(object)]
pub struct JsTreeNodeDump {
    pub depth: u32,
    pub name: String,
    pub control_type: String,
    pub automation_id: String,
    pub class_name: String,
    pub framework_id: String,
    pub runtime_id: String,
    pub is_offscreen: bool,
    pub patterns: Vec<String>,
    pub bounds: Option<JsA11yBounds>,
    pub children: Option<Vec<JsTreeNodeDump>>,
}

#[napi(object)]
pub struct JsA11yQuery {
    pub name: Option<String>,
    pub name_contains: Option<String>,
    pub control_type: Option<String>,
    pub automation_id: Option<String>,
    pub match_mode: Option<String>,
}

#[napi(object)]
pub struct JsTreeHealth {
    pub max_depth: u32,
    pub total_nodes: u32,
    pub list_item_count: u32,
    pub edit_count: u32,
    pub button_count: u32,
    pub control_type_counts: std::collections::HashMap<String, u32>,
}

fn a11y_config_from_js(c: Option<JsA11yConfig>) -> A11yConfig {
    match c {
        Some(cfg) => A11yConfig {
            attach_delay_ms: cfg.attach_delay_ms.unwrap_or(500) as u64,
            event_subscription: cfg.event_subscription.unwrap_or(true),
            tree_wait_timeout_ms: cfg.tree_wait_timeout_ms.unwrap_or(15_000) as u64,
            tree_wait_poll_ms: cfg.tree_wait_poll_ms.unwrap_or(300) as u64,
            min_list_item_count: cfg.min_list_item_count.unwrap_or(1),
            tree_view: cfg
                .tree_view
                .as_deref()
                .map(TreeViewMode::from_str)
                .unwrap_or_default(),
        },
        None => A11yConfig::default(),
    }
}

fn tree_view_from_js(v: Option<String>) -> Option<TreeViewMode> {
    v.map(|s| TreeViewMode::from_str(&s))
}

fn bounds_to_js(b: A11yBounds) -> JsA11yBounds {
    JsA11yBounds {
        left: b.left,
        top: b.top,
        width: b.width,
        height: b.height,
    }
}

fn element_info_to_js(i: ElementInfo) -> JsElementInfo {
    JsElementInfo {
        name: i.name,
        control_type: i.control_type,
        automation_id: i.automation_id,
        class_name: i.class_name,
        framework_id: i.framework_id,
        runtime_id: i.runtime_id,
        is_offscreen: i.is_offscreen,
        patterns: i.patterns,
        bounds: i.bounds.map(bounds_to_js),
    }
}

fn tree_node_to_js(n: TreeNodeDump) -> JsTreeNodeDump {
    JsTreeNodeDump {
        depth: n.depth,
        name: n.name,
        control_type: n.control_type,
        automation_id: n.automation_id,
        class_name: n.class_name,
        framework_id: n.framework_id,
        runtime_id: n.runtime_id,
        is_offscreen: n.is_offscreen,
        patterns: n.patterns,
        bounds: n.bounds.map(bounds_to_js),
        children: n
            .children
            .map(|kids| kids.into_iter().map(tree_node_to_js).collect()),
    }
}

fn attach_report_to_js(r: AttachReport) -> JsAttachReport {
    JsAttachReport {
        element_id: format_element_id(A11yElementId(r.element_id)),
        client_mode: r.client_mode,
        event_handler_registered: r.event_handler_registered,
        structure_changed_events: r.structure_changed_events,
        health_initial: tree_health_to_js(r.health_initial),
        health_final: tree_health_to_js(r.health_final),
        tree_wait_ms: r.tree_wait_ms.min(u32::MAX as u64) as u32,
        attach_strategy: r.attach_strategy,
        attached_hwnd: r.attached_hwnd.to_string(),
        tree_view: r.tree_view,
        candidates: r
            .candidates
            .into_iter()
            .map(|c| JsAttachCandidate {
                hwnd: c.hwnd.to_string(),
                class_name: c.class_name,
                total_nodes: c.total_nodes,
                list_item_count: c.list_item_count,
                edit_count: c.edit_count,
                chosen: c.chosen,
            })
            .collect(),
        diagnosis: r.diagnosis,
    }
}

fn a11y_query_from_js(q: &JsA11yQuery) -> A11yQuery {
    A11yQuery {
        name: q.name.clone(),
        name_contains: q.name_contains.clone(),
        control_type: q.control_type.clone(),
        automation_id: q.automation_id.clone(),
        match_mode: q.match_mode.clone().unwrap_or_else(|| "exact".to_string()),
    }
}

fn tree_health_to_js(h: TreeHealth) -> JsTreeHealth {
    JsTreeHealth {
        max_depth: h.max_depth,
        total_nodes: h.total_nodes,
        list_item_count: h.list_item_count,
        edit_count: h.edit_count,
        button_count: h.button_count,
        control_type_counts: h.control_type_counts,
    }
}

#[napi]
pub fn accessibility_enable(config: Option<JsA11yConfig>) -> Result<()> {
    a11y_enable(Some(a11y_config_from_js(config))).map_err(map_err)
}

#[napi]
pub fn accessibility_disable() -> Result<()> {
    a11y_disable().map_err(map_err)
}

#[napi]
pub fn accessibility_is_enabled() -> bool {
    is_accessibility_enabled()
}

#[napi]
pub fn accessibility_attach_window(window_id: String) -> Result<String> {
    let wid = parse_window_id(&window_id).map_err(map_err)?;
    let el = a11y_attach_window(wid).map_err(map_err)?;
    Ok(format_element_id(el))
}

#[napi]
pub fn accessibility_attach_window_report(
    window_id: String,
    max_depth: Option<u32>,
) -> Result<JsAttachReport> {
    let wid = parse_window_id(&window_id).map_err(map_err)?;
    let report = a11y_attach_window_report(wid, max_depth.unwrap_or(12)).map_err(map_err)?;
    Ok(attach_report_to_js(report))
}

#[napi]
pub fn accessibility_attach_active() -> Result<String> {
    let el = a11y_attach_active().map_err(map_err)?;
    Ok(format_element_id(el))
}

#[napi]
pub fn accessibility_find(
    root_id: String,
    query: JsA11yQuery,
    max_depth: Option<u32>,
) -> Result<String> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    let q = a11y_query_from_js(&query);
    let el = a11y_find_descendant(root, &q, max_depth.unwrap_or(12)).map_err(map_err)?;
    Ok(format_element_id(el))
}

#[napi]
pub fn accessibility_wait_for(
    root_id: String,
    query: JsA11yQuery,
    timeout_ms: u32,
    max_depth: Option<u32>,
    poll_ms: Option<u32>,
) -> Result<String> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    let q = a11y_query_from_js(&query);
    let el = a11y_wait_for_descendant(
        root,
        &q,
        max_depth.unwrap_or(12),
        timeout_ms as u64,
        poll_ms.unwrap_or(200) as u64,
    )
    .map_err(map_err)?;
    Ok(format_element_id(el))
}

#[napi]
pub fn accessibility_get_bounds(element_id: String) -> Result<JsRegion> {
    let id = parse_element_id(&element_id).map_err(map_err)?;
    a11y_get_bounds(id).map(region_to_js).map_err(map_err)
}

#[napi]
pub fn accessibility_invoke(element_id: String) -> Result<()> {
    let id = parse_element_id(&element_id).map_err(map_err)?;
    a11y_invoke(id).map_err(map_err)
}

#[napi]
pub fn accessibility_set_value(element_id: String, text: String) -> Result<()> {
    let id = parse_element_id(&element_id).map_err(map_err)?;
    a11y_set_value(id, &text).map_err(map_err)
}

#[napi]
pub fn accessibility_dump_tree(
    root_id: String,
    max_depth: Option<u32>,
    tree_view: Option<String>,
) -> Result<String> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    a11y_dump_tree(root, max_depth.unwrap_or(12), tree_view_from_js(tree_view)).map_err(map_err)
}

#[napi]
pub fn accessibility_dump_tree_object(
    root_id: String,
    max_depth: Option<u32>,
    tree_view: Option<String>,
) -> Result<JsTreeNodeDump> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    a11y_dump_tree_node(root, max_depth.unwrap_or(12), tree_view_from_js(tree_view))
        .map(tree_node_to_js)
        .map_err(map_err)
}

#[napi]
pub fn accessibility_get_element_info(element_id: String) -> Result<JsElementInfo> {
    let id = parse_element_id(&element_id).map_err(map_err)?;
    a11y_get_element_info(id)
        .map(element_info_to_js)
        .map_err(map_err)
}

#[napi]
pub fn accessibility_refresh_root(element_id: String) -> Result<()> {
    let id = parse_element_id(&element_id).map_err(map_err)?;
    a11y_refresh_root(id).map_err(map_err)
}

#[napi]
pub fn accessibility_tree_health(
    root_id: String,
    max_depth: Option<u32>,
    tree_view: Option<String>,
) -> Result<JsTreeHealth> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    a11y_tree_health(root, max_depth.unwrap_or(12), tree_view_from_js(tree_view))
        .map(tree_health_to_js)
        .map_err(map_err)
}

#[napi]
pub fn accessibility_check_tree_health(
    root_id: String,
    max_depth: Option<u32>,
    min_list_items: u32,
) -> Result<JsTreeHealth> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    check_tree_health(root, max_depth.unwrap_or(12), min_list_items)
        .map(tree_health_to_js)
        .map_err(map_err)
}
