//! AT-SPI2 backend (Linux). Requires `accessibility-linux` feature and session D-Bus.

use super::state::{self, store_element_linux};
use super::types::{A11yBounds, A11yConfig, A11yElementId, A11yQuery, TreeHealth, TreeNodeDump};
use crate::error::{Result, SpotterError};
use crate::types::{Region, WindowId};
use atspi::connection::AccessibilityConnection;
use atspi::proxy::accessible::AccessibleProxy;
use atspi_common::role::Role;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::OnceLock;

pub struct StoredElement {
    pub path: String,
}

struct AtspiSession {
    conn: AccessibilityConnection,
}

static SESSION: OnceLock<AtspiSession> = OnceLock::new();
static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn runtime() -> Result<&'static tokio::runtime::Runtime> {
    RT.get_or_try_init(|| {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| SpotterError::Platform(format!("tokio runtime: {e}")))
    })
}

pub fn set_config(_config: A11yConfig) {}

pub fn init_session() -> Result<()> {
    if SESSION.get().is_some() {
        return Ok(());
    }
    let rt = runtime()?;
    let conn = rt
        .block_on(AccessibilityConnection::new())
        .map_err(|e| SpotterError::Platform(format!("AT-SPI connect: {e}")))?;
    let _ = SESSION.set(AtspiSession { conn });
    Ok(())
}

fn session() -> Result<&'static AtspiSession> {
    SESSION
        .get()
        .ok_or(SpotterError::AccessibilityDisabled)
}

fn role_from_control_type(s: &str) -> Option<Role> {
    match s.trim().to_ascii_lowercase().as_str() {
        "listitem" | "list_item" => Some(Role::ListItem),
        "button" => Some(Role::PushButton),
        "edit" | "text" => Some(Role::Text),
        "document" => Some(Role::Document),
        "pane" => Some(Role::Panel),
        _ => None,
    }
}

fn role_name(role: Role) -> String {
    format!("{role:?}")
}

async fn proxy_for_path<'a>(
    conn: &'a AccessibilityConnection,
    path: &str,
) -> Result<AccessibleProxy<'a>> {
    let p = zbus::zvariant::OwnedObjectPath::from_str(path)
        .map_err(|e| SpotterError::Platform(format!("path: {e}")))?;
    AccessibleProxy::builder(conn.connection())
        .path(p)?
        .build()
        .await
        .map_err(|e| SpotterError::Platform(format!("AccessibleProxy: {e}")))
}

async fn matches_query(proxy: &AccessibleProxy<'_>, query: &A11yQuery) -> Result<bool> {
    if let Some(ref ct) = query.control_type {
        if let Some(expected) = role_from_control_type(ct) {
            if proxy.get_role().await.unwrap_or(Role::Unknown) != expected {
                return Ok(false);
            }
        }
    }
    let name = proxy.name().await.unwrap_or_default();
    if let Some(ref n) = query.name {
        let mode = query.match_mode.to_ascii_lowercase();
        if mode == "contains" {
            if !name.contains(n.as_str()) {
                return Ok(false);
            }
        } else if name != *n {
            return Ok(false);
        }
    }
    if let Some(ref sub) = query.name_contains {
        if !name.contains(sub.as_str()) {
            return Ok(false);
        }
    }
    Ok(true)
}

async fn find_rec(
    conn: &AccessibilityConnection,
    path: &str,
    query: &A11yQuery,
    depth: u32,
    max_depth: u32,
) -> Result<String> {
    if depth > max_depth {
        return Err(SpotterError::ElementNotFound("max depth exceeded".into()));
    }
    let proxy = proxy_for_path(conn, path).await?;
    if matches_query(&proxy, query).await? {
        return Ok(path.to_string());
    }
    let children = proxy
        .get_children()
        .await
        .map_err(|e| SpotterError::Platform(format!("get_children: {e}")))?;
    for child in children {
        let child_path = child.to_string();
        if let Ok(found) = Box::pin(find_rec(conn, &child_path, query, depth + 1, max_depth)).await {
            return Ok(found);
        }
    }
    Err(SpotterError::ElementNotFound(format!("{query:?}")))
}

pub fn attach_window(_id: WindowId) -> Result<A11yElementId> {
    let s = session()?;
    let rt = runtime()?;
    let path = rt.block_on(async {
        let desktop = AccessibleProxy::builder(s.conn.connection())
            .path("/org/a11y/atspi/accessible/root")?
            .build()
            .await
            .map_err(|e| SpotterError::Platform(format!("desktop: {e}")))?;
        let apps = desktop
            .get_children()
            .await
            .map_err(|e| SpotterError::Platform(format!("apps: {e}")))?;
        apps.first()
            .map(|p| p.to_string())
            .ok_or_else(|| SpotterError::WindowNotFound("no AT-SPI applications".into()))
    })?;
    Ok(store_element_linux(StoredElement { path }))
}

pub fn attach_active() -> Result<A11yElementId> {
    let active = crate::window::get_active_window()?;
    attach_window(active.id)
}

pub fn find_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
) -> Result<A11yElementId> {
    let s = session()?;
    let rt = runtime()?;
    state::with_element_linux(root, |stored| {
        let found = rt.block_on(find_rec(&s.conn, &stored.path, query, 0, max_depth))?;
        Ok(store_element_linux(StoredElement { path: found }))
    })
}

pub fn wait_for_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
    timeout_ms: u64,
    poll_ms: u64,
) -> Result<A11yElementId> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(timeout_ms);
    let interval = std::time::Duration::from_millis(poll_ms.max(50));
    loop {
        match find_descendant(root, query, max_depth) {
            Ok(id) => return Ok(id),
            Err(SpotterError::ElementNotFound(_)) => {
                if std::time::Instant::now() >= deadline {
                    return Err(SpotterError::ElementNotFound(format!(
                        "timeout after {timeout_ms}ms"
                    )));
                }
                std::thread::sleep(interval);
            }
            Err(e) => return Err(e),
        }
    }
}

pub fn get_bounds(id: A11yElementId) -> Result<Region> {
    let s = session()?;
    let rt = runtime()?;
    state::with_element_linux(id, |stored| {
        rt.block_on(async {
            let proxy = proxy_for_path(&s.conn, &stored.path).await?;
            let ext = proxy
                .get_extents(atspi::proxy::accessible::CoordinateType::Screen)
                .await
                .map_err(|e| SpotterError::Platform(format!("extents: {e}")))?;
            Ok(Region {
                left: ext.x,
                top: ext.y,
                width: ext.width as i32,
                height: ext.height as i32,
            })
        })
    })
}

pub fn invoke(id: A11yElementId) -> Result<()> {
    let s = session()?;
    let rt = runtime()?;
    state::with_element_linux(id, |stored| {
        rt.block_on(async {
            let proxy = proxy_for_path(&s.conn, &stored.path).await?;
            proxy
                .do_action(0)
                .await
                .map_err(|e| SpotterError::Platform(format!("do_action: {e}")))?;
            Ok(())
        })
    })
}

pub fn set_value(id: A11yElementId, text: &str) -> Result<()> {
    let s = session()?;
    let rt = runtime()?;
    let text = text.to_string();
    state::with_element_linux(id, |stored| {
        rt.block_on(async {
            let text_iface = atspi::proxy::text::TextProxy::builder(s.conn.connection())
                .path(stored.path.as_str())?
                .build()
                .await
                .map_err(|e| SpotterError::PatternNotSupported(format!("Text: {e}")))?;
            text_iface
                .set_text_contents(0, i32::MAX, &text)
                .await
                .map_err(|e| SpotterError::Platform(format!("set_text: {e}")))?;
            Ok(())
        })
    })
}

async fn build_dump(
    conn: &AccessibilityConnection,
    path: &str,
    depth: u32,
    max_depth: u32,
) -> Result<TreeNodeDump> {
    let proxy = proxy_for_path(conn, path).await?;
    let name = proxy.name().await.unwrap_or_default();
    let role = proxy.get_role().await.unwrap_or(Role::Unknown);
    let bounds = proxy
        .get_extents(atspi::proxy::accessible::CoordinateType::Screen)
        .await
        .ok()
        .map(|ext| A11yBounds {
            left: ext.x,
            top: ext.y,
            width: ext.width as i32,
            height: ext.height as i32,
        });
    let mut children = Vec::new();
    if depth < max_depth {
        if let Ok(kids) = proxy.get_children().await {
            for child in kids {
                let child_path = child.to_string();
                if let Ok(node) = Box::pin(build_dump(conn, &child_path, depth + 1, max_depth)).await
                {
                    children.push(node);
                }
            }
        }
    }
    Ok(TreeNodeDump {
        depth,
        name,
        control_type: role_name(role),
        automation_id: String::new(),
        bounds,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    })
}

pub fn dump_tree(root: A11yElementId, max_depth: u32) -> Result<String> {
    let s = session()?;
    let rt = runtime()?;
    state::with_element_linux(root, |stored| {
        let tree = rt.block_on(build_dump(&s.conn, &stored.path, 0, max_depth))?;
        serde_json::to_string_pretty(&tree)
            .map_err(|e| SpotterError::Platform(format!("json: {e}")))
    })
}

fn health_from_node(n: &TreeNodeDump, depth: u32, health: &mut TreeHealth) {
    health.total_nodes += 1;
    health.max_depth = health.max_depth.max(depth);
    *health
        .control_type_counts
        .entry(n.control_type.clone())
        .or_insert(0) += 1;
    if n.control_type.contains("ListItem") {
        health.list_item_count += 1;
    }
    if n.control_type.contains("Text") {
        health.edit_count += 1;
    }
    if n.control_type.contains("PushButton") {
        health.button_count += 1;
    }
    if let Some(ref kids) = n.children {
        for c in kids {
            health_from_node(c, depth + 1, health);
        }
    }
}

pub fn tree_health(root: A11yElementId, max_depth: u32) -> Result<TreeHealth> {
    let json = dump_tree(root, max_depth)?;
    let root_node: TreeNodeDump = serde_json::from_str(&json)
        .map_err(|e| SpotterError::Platform(format!("parse dump: {e}")))?;
    let mut health = TreeHealth {
        max_depth: 0,
        total_nodes: 0,
        control_type_counts: HashMap::new(),
        list_item_count: 0,
        edit_count: 0,
        button_count: 0,
    };
    health_from_node(&root_node, 0, &mut health);
    Ok(health)
}

pub fn check_tree_health(
    root: A11yElementId,
    max_depth: u32,
    min_list_items: u32,
) -> Result<TreeHealth> {
    let h = tree_health(root, max_depth)?;
    if h.list_item_count < min_list_items && h.total_nodes < 5 {
        return Err(SpotterError::TreeUnavailable(format!(
            "thinned tree: list_items={}",
            h.list_item_count
        )));
    }
    Ok(h)
}
