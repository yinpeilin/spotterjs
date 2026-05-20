//! Spotter — cross-platform desktop automation core.

#[cfg(windows)]
extern crate windows_core;

pub mod accessibility;
pub mod capture;
pub mod clipboard;
pub mod error;
pub mod input;
pub mod keyboard;
pub mod matcher;
pub mod platform;
pub mod screen;
pub mod types;
pub mod window;

pub use accessibility::{
    attach_active as a11y_attach_active, attach_window as a11y_attach_window,
    attach_window_report as a11y_attach_window_report, check_tree_health,
    disable as a11y_disable, dump_tree as a11y_dump_tree, enable as a11y_enable,
    find_descendant as a11y_find_descendant, format_element_id, get_bounds as a11y_get_bounds,
    invoke as a11y_invoke, is_accessibility_enabled, parse_element_id,
    set_value as a11y_set_value, tree_health as a11y_tree_health,
    wait_for_descendant as a11y_wait_for_descendant, A11yConfig, A11yElementId, A11yQuery,
    AttachReport, TreeHealth,
};
pub use capture::{capture_screen, capture_window};
pub use clipboard::{clipboard_get, clipboard_set};
pub use error::{Result, SpotterError};
pub use spotter_base::{MatchPlugin, OcrPlugin};
pub use input::{
    mouse_click, mouse_config, mouse_double_click, mouse_drag_to, mouse_get_position, mouse_move,
    mouse_move_path, mouse_press, mouse_release, mouse_scroll_down, mouse_scroll_left,
    mouse_scroll_right, mouse_scroll_up, set_mouse_config, straight_line_points, tap_at,
    MouseConfig,
};
pub use keyboard::{
    keyboard_config, keyboard_press, keyboard_release, keyboard_type, keyboard_type_keys,
    parse_key, parse_keys, set_keyboard_config, Key, KeyboardConfig,
};
pub use matcher::{
    find_all_templates, find_all_templates_in_window, find_template, find_template_in_window,
    tap_template, wait_for_template,
};
pub use screen::{clamp_region_to_screen, region_center, screen_height, screen_size, screen_width};
pub use types::{MatchOptions, MouseButton, Point, Region, RgbaImage, WindowId, WindowInfo};
pub use window::{
    focus_window, get_active_window, get_window_client_origin, get_window_region,
    get_window_region_clamped, list_windows, minimize_window, move_window, parse_window_id,
    resize_window, restore_window,
};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
