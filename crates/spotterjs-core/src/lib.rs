//! spotterjs - cross-platform desktop automation core.

#[cfg(windows)]
extern crate windows_core;

pub mod accessibility;
pub mod capture;
pub mod clipboard;
pub mod color;
pub mod desktop;
pub mod diff;
pub mod error;
pub mod events;
pub mod image;
pub mod input;
pub mod keyboard;
pub mod matcher;
pub mod needle_cache;
pub mod platform;
pub mod screen;
pub mod types;
pub mod window;

pub use accessibility::{
    attach_active as a11y_attach_active, attach_window as a11y_attach_window,
    attach_window_report as a11y_attach_window_report, check_tree_health, disable as a11y_disable,
    dump_tree as a11y_dump_tree, dump_tree_node as a11y_dump_tree_node, enable as a11y_enable,
    find_descendant as a11y_find_descendant, format_element_id, get_bounds as a11y_get_bounds,
    get_element_info as a11y_get_element_info, invoke as a11y_invoke, is_accessibility_enabled,
    parse_element_id, refresh_root as a11y_refresh_root, set_value as a11y_set_value,
    tree_health as a11y_tree_health, wait_for_descendant as a11y_wait_for_descendant, A11yBounds,
    A11yConfig, A11yElementId, A11yQuery, AttachCandidate, AttachReport, ElementInfo, TreeHealth,
    TreeNodeDump, TreeViewMode,
};
pub use capture::{capture_screen, capture_window};
pub use clipboard::{clipboard_get, clipboard_set};
pub use color::{
    color_within, find_all_color, find_all_color_in_image, find_color, find_color_in_image,
    get_pixel_color, pixel_color, wait_for_color,
};
pub use desktop::{
    find_apps, find_windows, get_foreground_app, list_desktop_apps, wait_for_window,
};
pub use diff::{region_changed, region_diff, wait_for_screen_stable, DiffStats};
pub use error::{Result, SpotterError};
pub use events::{
    guard_synthetic_input, is_synthetic_input, play_script, play_script_json, play_script_with,
    start_listener, start_recording, stop_recording, EventRecorder, EventSink, Hotkey,
    HotkeyRegistry, InputEvent, ListenerHandle, ListenerOptions, NativePlaybackTarget,
    PlaybackTarget, RecordedScript, RecordingOptions, ScriptAction,
};
pub use image::{
    encode_rgba_to_png, image_size_from_path, load_rgba_from_bytes, load_rgba_from_capture,
    load_rgba_from_path,
};
pub use input::{
    mouse_click, mouse_config, mouse_double_click, mouse_drag_to, mouse_get_position, mouse_move,
    mouse_move_path, mouse_press, mouse_release, mouse_scroll_down, mouse_scroll_left,
    mouse_scroll_right, mouse_scroll_up, set_mouse_config, straight_line_points, tap_at,
    MouseConfig,
};
pub use keyboard::{
    keyboard_config, keyboard_press, keyboard_press_with_config, keyboard_release,
    keyboard_release_with_config, keyboard_type, keyboard_type_keys,
    keyboard_type_keys_with_config, keyboard_type_with_config, parse_key, parse_keys,
    set_keyboard_config, Key, KeyboardConfig,
};
pub use matcher::{
    find_all_template_buffers, find_all_templates, find_all_templates_in_window,
    find_all_templates_in_window_with_needle, find_all_templates_with_needle, find_template,
    find_template_buffers, find_template_from_bytes, find_template_in_haystack,
    find_template_in_haystack_rgba, find_template_in_window, find_template_in_window_with_needle,
    find_template_with_needle, translate_region, wait_for_template, wait_for_template_buffers,
    wait_for_template_with_needle,
};
pub use screen::{clamp_region_to_screen, region_center, screen_height, screen_size, screen_width};
pub use spotterjs_base::{MatchPlugin, OcrPlugin};
pub use types::{
    DesktopApp, MatchBackend, MatchOptions, MouseButton, Point, Region, Rgb, RgbaImage, WindowId,
    WindowInfo,
};
pub use window::{
    focus_window, get_active_window, get_window_client_origin, get_window_region,
    get_window_region_clamped, list_windows, minimize_window, move_window, parse_window_id,
    resize_window, restore_window,
};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
