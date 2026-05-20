use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Opaque element reference for JS/native (maps to platform object in registry).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct A11yElementId(pub u64);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yConfig {
    pub attach_delay_ms: u64,
    /// Register UIA StructureChanged handler (WeChat 4.1+ client mode).
    #[serde(default = "default_true")]
    pub event_subscription: bool,
    /// Poll until tree grows or timeout (ms). 0 = skip wait.
    #[serde(default = "default_tree_wait_timeout")]
    pub tree_wait_timeout_ms: u64,
    #[serde(default = "default_tree_wait_poll")]
    pub tree_wait_poll_ms: u64,
    #[serde(default = "default_min_list_items")]
    pub min_list_item_count: u32,
}

fn default_true() -> bool {
    true
}
fn default_tree_wait_timeout() -> u64 {
    15_000
}
fn default_tree_wait_poll() -> u64 {
    300
}
fn default_min_list_items() -> u32 {
    1
}

impl Default for A11yConfig {
    fn default() -> Self {
        Self {
            attach_delay_ms: 500,
            event_subscription: true,
            tree_wait_timeout_ms: 15_000,
            tree_wait_poll_ms: 300,
            min_list_item_count: 1,
        }
    }
}

/// Result of attach + optional client-mode tree expansion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachReport {
    pub element_id: u64,
    pub client_mode: bool,
    pub event_handler_registered: bool,
    pub structure_changed_events: u32,
    pub health_initial: TreeHealth,
    pub health_final: TreeHealth,
    pub tree_wait_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yQuery {
    pub name: Option<String>,
    pub name_contains: Option<String>,
    /// e.g. ListItem, Button, Edit, Pane, Text, Document
    pub control_type: Option<String>,
    pub automation_id: Option<String>,
    /// exact | contains (for name field when `name` is set)
    #[serde(default = "default_match")]
    pub match_mode: String,
}

fn default_match() -> String {
    "exact".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeHealth {
    pub max_depth: u32,
    pub total_nodes: u32,
    pub control_type_counts: HashMap<String, u32>,
    pub list_item_count: u32,
    pub edit_count: u32,
    pub button_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNodeDump {
    pub depth: u32,
    pub name: String,
    pub control_type: String,
    pub automation_id: String,
    pub bounds: Option<A11yBounds>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeNodeDump>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct A11yBounds {
    pub left: i32,
    pub top: i32,
    pub width: i32,
    pub height: i32,
}
