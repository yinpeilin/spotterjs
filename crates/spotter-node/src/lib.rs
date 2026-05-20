#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;
use spotter_base::napi::{
    capture_to_js, map_err, match_opts_from_js, region_from_js, region_to_js, JsCaptureImage,
    JsMatchOptions, JsRegion,
};
use spotter_core::{
    a11y_attach_active, a11y_attach_window, a11y_attach_window_report, a11y_disable, a11y_dump_tree,
    a11y_enable, a11y_find_descendant, a11y_get_bounds, a11y_invoke, a11y_set_value, a11y_tree_health,
    a11y_wait_for_descendant, check_tree_health, clipboard_get, clipboard_set, format_element_id,
    is_accessibility_enabled, A11yElementId,
    keyboard_press, keyboard_release, keyboard_type, keyboard_type_keys, minimize_window, mouse_click,
    mouse_drag_to, mouse_get_position, mouse_move, move_window, parse_element_id, parse_key, parse_keys,
    parse_window_id, region_center, resize_window, restore_window, screen_height, screen_size, screen_width,
    set_keyboard_config, set_mouse_config, straight_line_points, A11yConfig, A11yQuery, AttachReport,
    KeyboardConfig, MouseButton, MouseConfig, Point, TreeHealth, WindowInfo, VERSION,
};
use std::path::Path;

/// Alias for shared capture type (same layout as `JsCaptureImage`).
pub type JsCaptureResult = JsCaptureImage;

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
pub fn region_center_js(region: JsRegion) -> JsPoint {
    let (x, y) = region_center(region_from_js(&region));
    JsPoint { x, y }
}

#[napi]
pub fn capture_screen(region: Option<JsRegion>) -> Result<JsCaptureResult> {
    let reg = region.as_ref().map(region_from_js);
    spotter_core::capture_screen(reg)
        .map(capture_to_js)
        .map_err(map_err)
}

#[napi]
pub fn capture_window(id: String) -> Result<JsCaptureResult> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::capture_window(wid)
        .map(capture_to_js)
        .map_err(map_err)
}

// --- Window ---

#[napi]
pub fn list_windows() -> Result<Vec<JsWindowInfo>> {
    spotter_core::list_windows()
        .map(|v| v.into_iter().map(window_to_js).collect())
        .map_err(map_err)
}

#[napi]
pub fn get_active_window() -> Result<JsWindowInfo> {
    spotter_core::get_active_window().map(window_to_js).map_err(map_err)
}

#[napi]
pub fn focus_window(id: String) -> Result<bool> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::focus_window(wid).map(|_| true).map_err(map_err)
}

#[napi]
pub fn get_window_region(id: String) -> Result<JsRegion> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::get_window_region(wid)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn get_window_region_clamped(id: String) -> Result<JsRegion> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::get_window_region_clamped(wid)
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn get_window_client_origin(id: String) -> Result<JsPoint> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    let (x, y) = spotter_core::get_window_client_origin(wid).map_err(map_err)?;
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

// --- Matcher ---

#[napi]
pub fn find_template(path: String, opts: Option<JsMatchOptions>) -> Result<JsRegion> {
    spotter_core::find_template(Path::new(&path), match_opts_from_js(opts))
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn find_all_templates(path: String, opts: Option<JsMatchOptions>) -> Result<Vec<JsRegion>> {
    spotter_core::find_all_templates(Path::new(&path), match_opts_from_js(opts))
        .map(|v| v.into_iter().map(region_to_js).collect())
        .map_err(map_err)
}

#[napi]
pub fn find_template_in_window(
    id: String,
    path: String,
    opts: Option<JsMatchOptions>,
) -> Result<JsRegion> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::find_template_in_window(wid, Path::new(&path), match_opts_from_js(opts))
        .map(region_to_js)
        .map_err(map_err)
}

#[napi]
pub fn find_all_templates_in_window(
    id: String,
    path: String,
    opts: Option<JsMatchOptions>,
) -> Result<Vec<JsRegion>> {
    let wid = parse_window_id(&id).map_err(map_err)?;
    spotter_core::find_all_templates_in_window(wid, Path::new(&path), match_opts_from_js(opts))
        .map(|v| v.into_iter().map(region_to_js).collect())
        .map_err(map_err)
}

#[napi]
pub fn wait_for_template(
    path: String,
    timeout_ms: u32,
    opts: Option<JsMatchOptions>,
    interval_ms: Option<u32>,
) -> Result<JsRegion> {
    spotter_core::wait_for_template(
        Path::new(&path),
        timeout_ms as u64,
        match_opts_from_js(opts),
        interval_ms.map(|v| v as u64),
    )
    .map(region_to_js)
    .map_err(map_err)
}

#[napi]
pub fn tap_template(path: String, opts: Option<JsMatchOptions>) -> Result<()> {
    spotter_core::tap_template(Path::new(&path), match_opts_from_js(opts)).map_err(map_err)
}

// --- Mouse ---

#[napi]
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
    spotter_core::mouse_move_path(&pts).map_err(map_err)
}

#[napi]
pub fn mouse_move_straight(x: i32, y: i32) -> Result<()> {
    let (cx, cy) = mouse_get_position().map_err(map_err)?;
    let line = straight_line_points(Point { x: cx, y: cy }, Point { x, y }, 5);
    spotter_core::mouse_move_path(&line.iter().map(|p| (p.x, p.y)).collect::<Vec<_>>()).map_err(map_err)
}

#[napi(js_name = "mouseClick")]
pub fn mouse_click_js(button: Option<String>) -> Result<()> {
    mouse_click(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_double_click(button: Option<String>) -> Result<()> {
    spotter_core::mouse_double_click(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_press(button: Option<String>) -> Result<()> {
    spotter_core::mouse_press(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_release(button: Option<String>) -> Result<()> {
    spotter_core::mouse_release(mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_drag(x: i32, y: i32, button: Option<String>) -> Result<()> {
    mouse_drag_to(x, y, mouse_button_from_str(button.as_deref())).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_up(amount: i32) -> Result<()> {
    spotter_core::mouse_scroll_up(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_down(amount: i32) -> Result<()> {
    spotter_core::mouse_scroll_down(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_left(amount: i32) -> Result<()> {
    spotter_core::mouse_scroll_left(amount).map_err(map_err)
}

#[napi]
pub fn mouse_scroll_right(amount: i32) -> Result<()> {
    spotter_core::mouse_scroll_right(amount).map_err(map_err)
}

#[napi]
pub fn tap_at(x: i32, y: i32, button: Option<String>) -> Result<()> {
    spotter_core::tap_at(x, y, mouse_button_from_str(button.as_deref())).map_err(map_err)
}

// --- Keyboard ---

#[napi]
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
        },
        None => A11yConfig::default(),
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
pub fn accessibility_dump_tree(root_id: String, max_depth: Option<u32>) -> Result<String> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    a11y_dump_tree(root, max_depth.unwrap_or(12)).map_err(map_err)
}

#[napi]
pub fn accessibility_tree_health(root_id: String, max_depth: Option<u32>) -> Result<JsTreeHealth> {
    let root = parse_element_id(&root_id).map_err(map_err)?;
    a11y_tree_health(root, max_depth.unwrap_or(12))
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
