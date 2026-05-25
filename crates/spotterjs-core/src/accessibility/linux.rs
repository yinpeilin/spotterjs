//! AT-SPI2 backend (Linux). Requires `accessibility-linux` feature and session D-Bus.

use super::state::{self, store_element_linux};
use super::types::{A11yBounds, A11yConfig, A11yElementId, A11yQuery, TreeHealth, TreeNodeDump};
use crate::error::{Result, SpotterError};
use crate::types::{Region, WindowId};
use atspi::connection::AccessibilityConnection;
use atspi::proxy::accessible::AccessibleProxy;
use atspi::proxy::action::ActionProxy;
use atspi::proxy::component::ComponentProxy;
use atspi::proxy::editable_text::EditableTextProxy;
use atspi::{CoordType, ObjectRef, Role};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[derive(Clone)]
pub struct StoredElement {
    pub bus_name: String,
    pub path: String,
}

struct AtspiSession {
    conn: AccessibilityConnection,
}

static SESSION: OnceLock<AtspiSession> = OnceLock::new();
static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
static CONFIG: OnceLock<Mutex<A11yConfig>> = OnceLock::new();

fn runtime() -> Result<&'static tokio::runtime::Runtime> {
    if let Some(rt) = RT.get() {
        return Ok(rt);
    }
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| SpotterError::Platform(format!("tokio runtime: {e}")))?;
    let _ = RT.set(rt);
    RT.get()
        .ok_or_else(|| SpotterError::Platform("tokio runtime unavailable".into()))
}

pub fn set_config(config: A11yConfig) {
    *CONFIG
        .get_or_init(|| Mutex::new(A11yConfig::default()))
        .lock()
        .expect("accessibility config poisoned") = config;
}

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
    SESSION.get().ok_or(SpotterError::AccessibilityDisabled)
}

fn normalize_control_type_name(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(c, '_' | '-' | ' '))
        .flat_map(char::to_lowercase)
        .collect()
}

fn role_aliases_for_control_type(s: &str) -> Option<&'static [&'static str]> {
    match normalize_control_type_name(s).as_str() {
        "listitem" => Some(&["ListItem"]),
        "menuitem" => Some(&[
            "MenuItem",
            "CheckMenuItem",
            "RadioMenuItem",
            "TearoffMenuItem",
        ]),
        "menu" => Some(&["Menu", "PopupMenu", "MenuBar"]),
        "list" => Some(&["List", "ListBox"]),
        "tab" => Some(&["PageTabList", "TabList", "Tab"]),
        "tabitem" => Some(&["PageTab", "TabItem"]),
        "checkbox" => Some(&["CheckBox", "CheckMenuItem"]),
        "radiobutton" => Some(&["RadioButton", "RadioMenuItem"]),
        "combobox" => Some(&["ComboBox"]),
        "window" => Some(&["Window", "Frame", "Dialog"]),
        "toolbar" => Some(&["ToolBar"]),
        "tree" => Some(&["Tree", "TreeTable"]),
        "treeitem" => Some(&["TreeItem"]),
        "group" => Some(&["Grouping", "Group", "Panel"]),
        "image" => Some(&["Image", "Icon", "ImageMap"]),
        "slider" => Some(&["Slider"]),
        "spinner" => Some(&["SpinButton", "Spinner"]),
        "hyperlink" | "link" => Some(&["Link", "Hyperlink"]),
        "custom" => Some(&["Extended", "Custom", "Canvas", "DrawingArea"]),
        "button" => Some(&["PushButton", "Button", "ToggleButton", "PushButtonMenu"]),
        "edit" => Some(&["Entry", "PasswordText", "Editbar", "Text"]),
        "text" => Some(&["Text", "Static", "Label"]),
        "document" => Some(&[
            "Document",
            "DocumentFrame",
            "DocumentSpreadsheet",
            "DocumentPresentation",
            "DocumentText",
            "DocumentWeb",
            "DocumentEmail",
            "HTMLContainer",
        ]),
        "pane" => Some(&[
            "Panel",
            "Pane",
            "ScrollPane",
            "RootPane",
            "LayeredPane",
            "GlassPane",
            "DesktopFrame",
            "DirectoryPane",
            "OptionPane",
            "Viewport",
        ]),
        _ => None,
    }
}

fn role_matches(actual: Role, expected_name: &str) -> bool {
    role_name_matches(&role_name(actual), expected_name)
}

fn role_name_matches(actual_name: &str, expected_name: &str) -> bool {
    role_aliases_for_control_type(expected_name)
        .map(|aliases| {
            let actual = normalize_control_type_name(actual_name);
            aliases
                .iter()
                .any(|alias| actual == normalize_control_type_name(alias))
        })
        .unwrap_or(false)
}

fn role_name(role: Role) -> String {
    format!("{role:?}")
}

fn stored_from_ref(reference: &ObjectRef) -> StoredElement {
    StoredElement {
        bus_name: reference.name.as_str().to_string(),
        path: reference.path.as_str().to_string(),
    }
}

fn runtime_id(stored: &StoredElement) -> String {
    format!("{}:{}", stored.bus_name, stored.path)
}

async fn accessible_proxy<'a>(
    conn: &'a AccessibilityConnection,
    stored: &'a StoredElement,
) -> Result<AccessibleProxy<'a>> {
    AccessibleProxy::builder(conn.connection())
        .destination(stored.bus_name.as_str())
        .map_err(|e| SpotterError::Platform(format!("AccessibleProxy destination: {e}")))?
        .path(stored.path.as_str())
        .map_err(|e| SpotterError::Platform(format!("AccessibleProxy path: {e}")))?
        .build()
        .await
        .map_err(|e| SpotterError::Platform(format!("AccessibleProxy: {e}")))
}

async fn component_proxy<'a>(
    conn: &'a AccessibilityConnection,
    stored: &'a StoredElement,
) -> Result<ComponentProxy<'a>> {
    ComponentProxy::builder(conn.connection())
        .destination(stored.bus_name.as_str())
        .map_err(|e| SpotterError::Platform(format!("ComponentProxy destination: {e}")))?
        .path(stored.path.as_str())
        .map_err(|e| SpotterError::Platform(format!("ComponentProxy path: {e}")))?
        .build()
        .await
        .map_err(|e| SpotterError::Platform(format!("ComponentProxy: {e}")))
}

async fn matches_query(proxy: &AccessibleProxy<'_>, query: &A11yQuery) -> Result<bool> {
    if let Some(ref ct) = query.control_type {
        if !role_matches(proxy.get_role().await.unwrap_or(Role::Unknown), ct) {
            return Ok(false);
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
    stored: &StoredElement,
    query: &A11yQuery,
    depth: u32,
    max_depth: u32,
) -> Result<StoredElement> {
    if depth > max_depth {
        return Err(SpotterError::ElementNotFound("max depth exceeded".into()));
    }
    let proxy = accessible_proxy(conn, stored).await?;
    if matches_query(&proxy, query).await? {
        return Ok(stored.clone());
    }
    let children = proxy
        .get_children()
        .await
        .map_err(|e| SpotterError::Platform(format!("get_children: {e}")))?;
    for child in children {
        let child_stored = stored_from_ref(&child);
        if let Ok(found) =
            Box::pin(find_rec(conn, &child_stored, query, depth + 1, max_depth)).await
        {
            return Ok(found);
        }
    }
    Err(SpotterError::ElementNotFound(format!("{query:?}")))
}

pub fn attach_window(_id: WindowId) -> Result<A11yElementId> {
    let s = session()?;
    let rt = runtime()?;
    let root = rt.block_on(async {
        let desktop = AccessibleProxy::builder(s.conn.connection())
            .destination("org.a11y.atspi.Registry")
            .map_err(|e| SpotterError::Platform(format!("desktop destination: {e}")))?
            .path("/org/a11y/atspi/accessible/root")
            .map_err(|e| SpotterError::Platform(format!("desktop path: {e}")))?
            .build()
            .await
            .map_err(|e| SpotterError::Platform(format!("desktop: {e}")))?;
        let apps = desktop
            .get_children()
            .await
            .map_err(|e| SpotterError::Platform(format!("apps: {e}")))?;
        apps.first()
            .map(stored_from_ref)
            .ok_or_else(|| SpotterError::WindowNotFound("no AT-SPI applications".into()))
    })?;
    Ok(store_element_linux(root))
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
        let found = rt.block_on(find_rec(&s.conn, stored, query, 0, max_depth))?;
        Ok(store_element_linux(found))
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
            let proxy = component_proxy(&s.conn, stored).await?;
            let (left, top, width, height) = proxy
                .get_extents(CoordType::Screen)
                .await
                .map_err(|e| SpotterError::Platform(format!("extents: {e}")))?;
            Ok(Region {
                left,
                top,
                width,
                height,
            })
        })
    })
}

pub fn invoke(id: A11yElementId) -> Result<()> {
    let s = session()?;
    let rt = runtime()?;
    state::with_element_linux(id, |stored| {
        rt.block_on(async {
            let proxy = ActionProxy::builder(s.conn.connection())
                .destination(stored.bus_name.as_str())
                .map_err(|e| SpotterError::Platform(format!("ActionProxy destination: {e}")))?
                .path(stored.path.as_str())
                .map_err(|e| SpotterError::Platform(format!("ActionProxy path: {e}")))?
                .build()
                .await
                .map_err(|e| SpotterError::PatternNotSupported(format!("Action: {e}")))?;
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
            let text_iface = EditableTextProxy::builder(s.conn.connection())
                .destination(stored.bus_name.as_str())
                .map_err(|e| SpotterError::Platform(format!("EditableText destination: {e}")))?
                .path(stored.path.as_str())
                .map_err(|e| SpotterError::Platform(format!("EditableText path: {e}")))?
                .build()
                .await
                .map_err(|e| SpotterError::PatternNotSupported(format!("EditableText: {e}")))?;
            text_iface
                .set_text_contents(&text)
                .await
                .map_err(|e| SpotterError::Platform(format!("set_text: {e}")))?;
            Ok(())
        })
    })
}

async fn build_dump(
    conn: &AccessibilityConnection,
    stored: &StoredElement,
    depth: u32,
    max_depth: u32,
) -> Result<TreeNodeDump> {
    let proxy = accessible_proxy(conn, stored).await?;
    let name = proxy.name().await.unwrap_or_default();
    let role = proxy.get_role().await.unwrap_or(Role::Unknown);
    let bounds =
        match component_proxy(conn, stored).await {
            Ok(component) => component.get_extents(CoordType::Screen).await.ok().map(
                |(left, top, width, height)| A11yBounds {
                    left,
                    top,
                    width,
                    height,
                },
            ),
            Err(_) => None,
        };
    let mut children = Vec::new();
    if depth < max_depth {
        if let Ok(kids) = proxy.get_children().await {
            for child in kids {
                let child_stored = stored_from_ref(&child);
                if let Ok(node) =
                    Box::pin(build_dump(conn, &child_stored, depth + 1, max_depth)).await
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
        class_name: String::new(),
        framework_id: String::new(),
        runtime_id: runtime_id(stored),
        is_offscreen: false,
        patterns: Vec::new(),
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
        let tree = rt.block_on(build_dump(&s.conn, stored, 0, max_depth))?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_common_control_type_names() {
        let cases = [
            ("MenuItem", "MenuItem"),
            ("Menu", "Menu"),
            ("List", "List"),
            ("Tab", "PageTabList"),
            ("TabItem", "PageTab"),
            ("CheckBox", "CheckBox"),
            ("RadioButton", "RadioButton"),
            ("ComboBox", "ComboBox"),
            ("Window", "Frame"),
            ("ToolBar", "ToolBar"),
            ("Tree", "Tree"),
            ("TreeItem", "TreeItem"),
            ("Group", "Grouping"),
            ("Image", "Image"),
            ("Slider", "Slider"),
            ("Spinner", "SpinButton"),
            ("Hyperlink", "Link"),
            ("Custom", "Extended"),
        ];

        for (name, role_name) in cases {
            assert!(role_name_matches(role_name, name), "{name}");
        }
    }

    #[test]
    fn unknown_control_type_matches_nothing() {
        assert!(role_name_matches("PushButton", "Button"));
        assert!(!role_name_matches("PushButton", "DefinitelyUnknown"));
    }
}
