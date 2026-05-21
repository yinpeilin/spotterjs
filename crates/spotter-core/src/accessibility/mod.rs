//! Cross-platform accessibility (UI Automation on Windows, AT-SPI2 on Linux).
//!
//! Call [`enable`] before any other API. COM / D-Bus session is initialized lazily on first use.

mod state;
mod types;

#[cfg(windows)]
mod uia_handler;

#[cfg(windows)]
mod windows;

#[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
mod linux;

pub use types::{
    A11yBounds, A11yConfig, A11yElementId, A11yQuery, AttachCandidate, AttachReport, ElementInfo,
    TreeHealth, TreeNodeDump, TreeViewMode,
};

use crate::error::{Result, SpotterError};
use crate::types::WindowId;
use state::{element_id_from_string, element_id_to_string, is_enabled, require_enabled, set_enabled};
use std::env;

/// Enable accessibility (idempotent). Honors `SPOTTER_ACCESSIBILITY=1`.
pub fn enable(config: Option<A11yConfig>) -> Result<()> {
    if env::var("SPOTTER_ACCESSIBILITY").as_deref() == Ok("0") {
        return Err(SpotterError::AccessibilityDisabled);
    }
    set_enabled(true);
    if let Some(cfg) = config {
        platform_set_config(cfg);
    }
    platform_init_session()
}

pub fn disable() -> Result<()> {
    set_enabled(false);
    Ok(())
}

pub fn is_accessibility_enabled() -> bool {
    is_enabled()
}

pub fn attach_window(id: WindowId) -> Result<A11yElementId> {
    require_enabled()?;
    platform_attach_window(id)
}

/// Attach with UIA client mode: optional StructureChanged subscription + wait for tree expansion.
pub fn attach_window_report(id: WindowId, max_depth: u32) -> Result<AttachReport> {
    require_enabled()?;
    platform_attach_window_report(id, max_depth)
}

pub fn attach_active() -> Result<A11yElementId> {
    require_enabled()?;
    platform_attach_active()
}

pub fn find_descendant(root: A11yElementId, query: &A11yQuery, max_depth: u32) -> Result<A11yElementId> {
    require_enabled()?;
    platform_find_descendant(root, query, max_depth)
}

pub fn wait_for_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
    timeout_ms: u64,
    poll_ms: u64,
) -> Result<A11yElementId> {
    require_enabled()?;
    platform_wait_for_descendant(root, query, max_depth, timeout_ms, poll_ms)
}

pub fn get_bounds(id: A11yElementId) -> Result<crate::types::Region> {
    require_enabled()?;
    platform_get_bounds(id)
}

pub fn invoke(id: A11yElementId) -> Result<()> {
    require_enabled()?;
    platform_invoke(id)
}

pub fn set_value(id: A11yElementId, text: &str) -> Result<()> {
    require_enabled()?;
    platform_set_value(id, text)
}

pub fn dump_tree(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<String> {
    require_enabled()?;
    platform_dump_tree(root, max_depth, tree_view)
}

pub fn dump_tree_node(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeNodeDump> {
    require_enabled()?;
    platform_dump_tree_node(root, max_depth, tree_view)
}

pub fn get_element_info(id: A11yElementId) -> Result<ElementInfo> {
    require_enabled()?;
    platform_get_element_info(id)
}

pub fn refresh_root(id: A11yElementId) -> Result<()> {
    require_enabled()?;
    platform_refresh_root(id)
}

pub fn tree_health(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeHealth> {
    require_enabled()?;
    platform_tree_health(root, max_depth, tree_view)
}

pub fn check_tree_health(
    root: A11yElementId,
    max_depth: u32,
    min_list_items: u32,
) -> Result<TreeHealth> {
    require_enabled()?;
    platform_check_tree_health(root, max_depth, min_list_items)
}

pub fn parse_element_id(s: &str) -> Result<A11yElementId> {
    element_id_from_string(s)
}

pub fn format_element_id(id: A11yElementId) -> String {
    element_id_to_string(id)
}

fn platform_set_config(config: A11yConfig) {
    #[cfg(windows)]
    windows::set_config(config);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    linux::set_config(config);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    let _ = config;
}

fn platform_init_session() -> Result<()> {
    #[cfg(windows)]
    return windows::init_session();
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::init_session();
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    Err(SpotterError::AccessibilityNotSupported)
}

fn platform_attach_window_report(id: WindowId, max_depth: u32) -> Result<AttachReport> {
    #[cfg(windows)]
    return windows::attach_window_report(id, max_depth);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let el = linux::attach_window(id)?;
        let h = linux::tree_health(el, max_depth)?;
        Ok(AttachReport {
            element_id: el.0,
            client_mode: false,
            event_handler_registered: false,
            structure_changed_events: 0,
            health_initial: h.clone(),
            health_final: h,
            tree_wait_ms: 0,
            attach_strategy: "top_level".into(),
            attached_hwnd: 0,
            tree_view: "raw".into(),
            candidates: Vec::new(),
            diagnosis: Vec::new(),
        })
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (id, max_depth);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_attach_window(id: WindowId) -> Result<A11yElementId> {
    #[cfg(windows)]
    return Ok(A11yElementId(
        windows::attach_window_report(id, 12)?.element_id,
    ));
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::attach_window(id);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_attach_active() -> Result<A11yElementId> {
    #[cfg(windows)]
    return windows::attach_active();
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::attach_active();
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    Err(SpotterError::AccessibilityNotSupported)
}

fn platform_find_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
) -> Result<A11yElementId> {
    #[cfg(windows)]
    return windows::find_descendant(root, query, max_depth);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::find_descendant(root, query, max_depth);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, query, max_depth);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_wait_for_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
    timeout_ms: u64,
    poll_ms: u64,
) -> Result<A11yElementId> {
    #[cfg(windows)]
    return windows::wait_for_descendant(root, query, max_depth, timeout_ms, poll_ms);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::wait_for_descendant(root, query, max_depth, timeout_ms, poll_ms);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, query, max_depth, timeout_ms, poll_ms);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_get_bounds(id: A11yElementId) -> Result<crate::types::Region> {
    #[cfg(windows)]
    return windows::get_bounds(id);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::get_bounds(id);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_invoke(id: A11yElementId) -> Result<()> {
    #[cfg(windows)]
    return windows::invoke(id);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::invoke(id);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_set_value(id: A11yElementId, text: &str) -> Result<()> {
    #[cfg(windows)]
    return windows::set_value(id, text);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::set_value(id, text);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (id, text);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_dump_tree(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<String> {
    #[cfg(windows)]
    return windows::dump_tree(root, max_depth, tree_view);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let _ = tree_view;
        return linux::dump_tree(root, max_depth);
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, max_depth, tree_view);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_dump_tree_node(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeNodeDump> {
    #[cfg(windows)]
    return windows::dump_tree_node(root, max_depth, tree_view);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let _ = tree_view;
        let json = linux::dump_tree(root, max_depth)?;
        serde_json::from_str(&json)
            .map_err(|e| SpotterError::Platform(format!("parse tree dump: {e}")))
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, max_depth, tree_view);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_get_element_info(id: A11yElementId) -> Result<ElementInfo> {
    #[cfg(windows)]
    return windows::get_element_info(id);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_refresh_root(id: A11yElementId) -> Result<()> {
    #[cfg(windows)]
    return windows::refresh_root(id);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let _ = id;
        Ok(())
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = id;
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_tree_health(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeHealth> {
    #[cfg(windows)]
    return windows::tree_health(root, max_depth, tree_view);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    {
        let _ = tree_view;
        return linux::tree_health(root, max_depth);
    }
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, max_depth, tree_view);
        Err(SpotterError::AccessibilityNotSupported)
    }
}

fn platform_check_tree_health(
    root: A11yElementId,
    max_depth: u32,
    min_list_items: u32,
) -> Result<TreeHealth> {
    #[cfg(windows)]
    return windows::check_tree_health(root, max_depth, min_list_items);
    #[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
    return linux::check_tree_health(root, max_depth, min_list_items);
    #[cfg(not(any(windows, all(target_os = "linux", feature = "accessibility-linux"))))]
    {
        let _ = (root, max_depth, min_list_items);
        Err(SpotterError::AccessibilityNotSupported)
    }
}
