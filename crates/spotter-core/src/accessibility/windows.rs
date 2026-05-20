use super::state::{self, store_element};
use super::types::{
    A11yBounds, A11yConfig, A11yElementId, A11yQuery, AttachReport, TreeHealth, TreeNodeDump,
};
use super::uia_handler::create_structure_handler;
use crate::error::{Result, SpotterError};
use crate::types::{Region, WindowId};
use crate::window::get_active_window;
use std::collections::HashMap;
use std::cell::RefCell;
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;
use windows::core::BSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationStructureChangedEventHandler,
    IUIAutomationTreeWalker, IUIAutomationInvokePattern, IUIAutomationValuePattern,
    TreeScope_Subtree, UIA_ButtonControlTypeId, UIA_DocumentControlTypeId, UIA_EditControlTypeId,
    UIA_ListItemControlTypeId, UIA_PaneControlTypeId, UIA_TextControlTypeId, UIA_InvokePatternId,
    UIA_ValuePatternId,
};

pub struct StoredElement {
    pub element: IUIAutomationElement,
}

struct UiaSessionInner {
    automation: IUIAutomation,
    walker: IUIAutomationTreeWalker,
    control_walker: IUIAutomationTreeWalker,
    structure_handler: Option<IUIAutomationStructureChangedEventHandler>,
    handler_events: Option<std::sync::Arc<std::sync::atomic::AtomicU32>>,
    subscribed_hwnd: Option<HWND>,
}

thread_local! {
    static SESSION: RefCell<Option<UiaSessionInner>> = RefCell::new(None);
}

static CONFIG: OnceLock<A11yConfig> = OnceLock::new();

pub fn set_config(config: A11yConfig) {
    let _ = CONFIG.set(config);
}

fn config() -> A11yConfig {
    CONFIG.get().cloned().unwrap_or_default()
}

pub fn init_session() -> Result<()> {
    SESSION.with(|cell| {
        if cell.borrow().is_some() {
            return Ok(());
        }
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let automation: IUIAutomation =
                CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL).map_err(|e| {
                    SpotterError::Platform(format!("CoCreateInstance(CUIAutomation): {e}"))
                })?;
            let walker = automation
                .RawViewWalker()
                .map_err(|e| SpotterError::Platform(format!("RawViewWalker: {e}")))?;
            let control_walker = automation
                .ControlViewWalker()
                .map_err(|e| SpotterError::Platform(format!("ControlViewWalker: {e}")))?;
            *cell.borrow_mut() = Some(UiaSessionInner {
                automation,
                walker,
                control_walker,
                structure_handler: None,
                handler_events: None,
                subscribed_hwnd: None,
            });
        }
        Ok(())
    })
}

fn with_session<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&UiaSessionInner) -> Result<T>,
{
    SESSION.with(|cell| {
        let guard = cell.borrow();
        let s = guard
            .as_ref()
            .ok_or(SpotterError::AccessibilityDisabled)?;
        f(s)
    })
}

fn with_session_mut<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&mut UiaSessionInner) -> Result<T>,
{
    SESSION.with(|cell| {
        let mut guard = cell.borrow_mut();
        let s = guard
            .as_mut()
            .ok_or(SpotterError::AccessibilityDisabled)?;
        f(s)
    })
}

fn hwnd_from_id(id: WindowId) -> HWND {
    HWND(id.0 as *mut std::ffi::c_void)
}

unsafe fn element_from_hwnd(automation: &IUIAutomation, hwnd: HWND) -> Result<IUIAutomationElement> {
    automation
        .ElementFromHandle(hwnd)
        .map_err(|e| SpotterError::Platform(format!("ElementFromHandle: {e}")))
}

unsafe fn tree_health_on_element(
    walker: &IUIAutomationTreeWalker,
    el: &IUIAutomationElement,
    max_depth: u32,
) -> TreeHealth {
    let mut counts = HashMap::new();
    let mut list_items = 0;
    let mut edits = 0;
    let mut buttons = 0;
    let mut total = 0;
    let mut max_d = 0;
    health_rec(
        walker,
        el,
        0,
        max_depth,
        &mut counts,
        &mut list_items,
        &mut edits,
        &mut buttons,
        &mut total,
        &mut max_d,
    );
    TreeHealth {
        max_depth: max_d,
        total_nodes: total,
        control_type_counts: counts,
        list_item_count: list_items,
        edit_count: edits,
        button_count: buttons,
    }
}

fn tree_is_rich(health: &TreeHealth, min_list_items: u32) -> bool {
    health.list_item_count >= min_list_items || health.total_nodes >= 10
}

unsafe fn unregister_structure_handler(session: &mut UiaSessionInner) {
    if let (Some(ref handler), Some(hwnd)) = (&session.structure_handler, session.subscribed_hwnd)
    {
        if let Ok(el) = session.automation.ElementFromHandle(hwnd) {
            let _ = session
                .automation
                .RemoveStructureChangedEventHandler(&el, handler);
        }
    }
    session.structure_handler = None;
    session.handler_events = None;
    session.subscribed_hwnd = None;
}

unsafe fn register_structure_handler(
    session: &mut UiaSessionInner,
    hwnd: HWND,
    element: &IUIAutomationElement,
) -> Result<bool> {
    unregister_structure_handler(session);
    let (handler, count) = create_structure_handler();
    let cache = session.automation.CreateCacheRequest().ok();
    let cache_ref = cache.as_ref();
    session
        .automation
        .AddStructureChangedEventHandler(element, TreeScope_Subtree, cache_ref, &handler)
        .map_err(|e| {
            SpotterError::Platform(format!("AddStructureChangedEventHandler: {e}"))
        })?;
    session.structure_handler = Some(handler);
    session.handler_events = Some(count);
    session.subscribed_hwnd = Some(hwnd);
    Ok(true)
}

fn wait_for_tree_expand(hwnd: HWND, max_depth: u32, initial: &TreeHealth) -> u64 {
    let cfg = config();
    if cfg.tree_wait_timeout_ms == 0 {
        return 0;
    }
    let deadline = std::time::Instant::now() + Duration::from_millis(cfg.tree_wait_timeout_ms);
    let poll = Duration::from_millis(cfg.tree_wait_poll_ms.max(100));
    let mut elapsed = 0u64;

    while std::time::Instant::now() < deadline {
        thread::sleep(poll);
        elapsed += poll.as_millis() as u64;
        let health = SESSION.with(|cell| {
            let guard = cell.borrow();
            let sess = guard.as_ref()?;
            unsafe {
                let el = element_from_hwnd(&sess.automation, hwnd).ok()?;
                let h = tree_health_on_element(&sess.control_walker, &el, max_depth);
                Some(h)
            }
        });
        if let Some(h) = health {
            if tree_is_rich(&h, cfg.min_list_item_count) {
                return elapsed;
            }
        }
    }
    let _ = initial;
    elapsed
}

pub fn attach_window_report(id: WindowId, max_depth: u32) -> Result<AttachReport> {
    let hwnd = hwnd_from_id(id);
    if hwnd.0.is_null() {
        return Err(SpotterError::InvalidWindowId(id.to_hex()));
    }
    let cfg = config();
    let delay = cfg.attach_delay_ms;
    if delay > 0 {
        thread::sleep(Duration::from_millis(delay));
    }

    let client_mode = cfg.event_subscription;
    let (health_initial, event_handler_registered, should_wait) =
        with_session_mut(|session| unsafe {
            let element = element_from_hwnd(&session.automation, hwnd)?;
            let health_initial = tree_health_on_element(&session.walker, &element, max_depth);
            let event_handler_registered = if client_mode {
                register_structure_handler(session, hwnd, &element).unwrap_or(false)
            } else {
                false
            };
            let should_wait =
                client_mode && event_handler_registered && cfg.tree_wait_timeout_ms > 0;
            Ok((health_initial, event_handler_registered, should_wait))
        })?;

    let tree_wait_ms = if should_wait {
        wait_for_tree_expand(hwnd, max_depth, &health_initial)
    } else {
        0
    };

    with_session_mut(|session| unsafe {
        let element_final = element_from_hwnd(&session.automation, hwnd)?;
        let health_final = if client_mode {
            tree_health_on_element(&session.control_walker, &element_final, max_depth)
        } else {
            tree_health_on_element(&session.walker, &element_final, max_depth)
        };

        let structure_events = session
            .handler_events
            .as_ref()
            .map(|c| c.load(std::sync::atomic::Ordering::Relaxed))
            .unwrap_or(0);

        let id_el = store_element(StoredElement {
            element: element_final,
        });

        Ok(AttachReport {
            element_id: id_el.0,
            client_mode,
            event_handler_registered,
            structure_changed_events: structure_events,
            health_initial,
            health_final,
            tree_wait_ms,
        })
    })
}

pub fn attach_window(id: WindowId) -> Result<A11yElementId> {
    Ok(A11yElementId(
        attach_window_report(id, 12)?.element_id,
    ))
}

pub fn attach_active() -> Result<A11yElementId> {
    let active = get_active_window()?;
    attach_window(active.id)
}

fn control_type_from_str(s: &str) -> Option<i32> {
    match s.trim().to_ascii_lowercase().as_str() {
        "listitem" | "list_item" => Some(UIA_ListItemControlTypeId.0 as i32),
        "button" => Some(UIA_ButtonControlTypeId.0 as i32),
        "edit" => Some(UIA_EditControlTypeId.0 as i32),
        "pane" => Some(UIA_PaneControlTypeId.0 as i32),
        "text" => Some(UIA_TextControlTypeId.0 as i32),
        "document" => Some(UIA_DocumentControlTypeId.0 as i32),
        _ => None,
    }
}

fn control_type_name(id: i32) -> String {
    if id == UIA_ListItemControlTypeId.0 {
        "ListItem".into()
    } else if id == UIA_ButtonControlTypeId.0 {
        "Button".into()
    } else if id == UIA_EditControlTypeId.0 {
        "Edit".into()
    } else if id == UIA_PaneControlTypeId.0 {
        "Pane".into()
    } else if id == UIA_TextControlTypeId.0 {
        "Text".into()
    } else if id == UIA_DocumentControlTypeId.0 {
        "Document".into()
    } else {
        format!("ControlType({id})")
    }
}

unsafe fn element_name(el: &IUIAutomationElement) -> String {
    el.CurrentName()
        .map(|b| b.to_string())
        .unwrap_or_default()
}

unsafe fn element_control_type(el: &IUIAutomationElement) -> i32 {
    el.CurrentControlType().map(|c| c.0).unwrap_or(0)
}

unsafe fn element_automation_id(el: &IUIAutomationElement) -> String {
    el.CurrentAutomationId()
        .map(|b| b.to_string())
        .unwrap_or_default()
}

unsafe fn element_bounds(el: &IUIAutomationElement) -> Option<A11yBounds> {
    let r = el.CurrentBoundingRectangle().ok()?;
    Some(A11yBounds {
        left: r.left,
        top: r.top,
        width: r.right - r.left,
        height: r.bottom - r.top,
    })
}

unsafe fn matches_query(el: &IUIAutomationElement, query: &A11yQuery) -> bool {
    if let Some(ref ct) = query.control_type {
        if let Some(expected) = control_type_from_str(ct) {
            if element_control_type(el) != expected {
                return false;
            }
        }
    }
    if let Some(ref aid) = query.automation_id {
        if element_automation_id(el) != *aid {
            return false;
        }
    }
    let name = element_name(el);
    if let Some(ref n) = query.name {
        let mode = query.match_mode.to_ascii_lowercase();
        if mode == "contains" {
            if !name.contains(n.as_str()) {
                return false;
            }
        } else if name != *n {
            return false;
        }
    }
    if let Some(ref sub) = query.name_contains {
        if !name.contains(sub.as_str()) {
            return false;
        }
    }
    true
}

unsafe fn find_rec(
    walker: &IUIAutomationTreeWalker,
    el: &IUIAutomationElement,
    query: &A11yQuery,
    depth: u32,
    max_depth: u32,
) -> Result<IUIAutomationElement> {
    if depth > max_depth {
        return Err(SpotterError::ElementNotFound("max depth exceeded".into()));
    }
    if matches_query(el, query) {
        return Ok(el.clone());
    }
    let mut child = walker.GetFirstChildElement(el).ok();
    while let Some(ref c) = child {
        if let Ok(found) = find_rec(walker, c, query, depth + 1, max_depth) {
            return Ok(found);
        }
        child = walker.GetNextSiblingElement(c).ok();
    }
    Err(SpotterError::ElementNotFound(format!("{query:?}")))
}

pub fn find_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
) -> Result<A11yElementId> {
    with_session(|s| {
        state::with_element(root, |stored| unsafe {
            let found = find_rec(&s.walker, &stored.element, query, 0, max_depth)?;
            Ok(store_element(StoredElement { element: found }))
        })
    })
}

pub fn wait_for_descendant(
    root: A11yElementId,
    query: &A11yQuery,
    max_depth: u32,
    timeout_ms: u64,
    poll_ms: u64,
) -> Result<A11yElementId> {
    let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
    let interval = Duration::from_millis(poll_ms.max(50));
    loop {
        match find_descendant(root, query, max_depth) {
            Ok(id) => return Ok(id),
            Err(SpotterError::ElementNotFound { .. }) => {
                if std::time::Instant::now() >= deadline {
                    return Err(SpotterError::ElementNotFound(format!(
                        "timeout after {timeout_ms}ms"
                    )));
                }
                thread::sleep(interval);
            }
            Err(e) => return Err(e),
        }
    }
}

pub fn get_bounds(id: A11yElementId) -> Result<Region> {
    state::with_element(id, |stored| unsafe {
        let b = element_bounds(&stored.element).ok_or_else(|| {
            SpotterError::Platform("no bounding rectangle".into())
        })?;
        Ok(Region {
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
        })
    })
}

pub fn invoke(id: A11yElementId) -> Result<()> {
    state::with_element(id, |stored| unsafe {
        let pattern: IUIAutomationInvokePattern = stored
            .element
            .GetCurrentPatternAs(UIA_InvokePatternId)
            .map_err(|e| SpotterError::PatternNotSupported(format!("Invoke: {e}")))?;
        pattern
            .Invoke()
            .map_err(|e| SpotterError::Platform(format!("Invoke: {e}")))?;
        Ok(())
    })
}

pub fn set_value(id: A11yElementId, text: &str) -> Result<()> {
    state::with_element(id, |stored| unsafe {
        let pattern: IUIAutomationValuePattern = stored
            .element
            .GetCurrentPatternAs(UIA_ValuePatternId)
            .map_err(|e| SpotterError::PatternNotSupported(format!("Value: {e}")))?;
        pattern
            .SetValue(&BSTR::from(text))
            .map_err(|e| SpotterError::Platform(format!("SetValue: {e}")))?;
        Ok(())
    })
}

unsafe fn build_dump(
    walker: &IUIAutomationTreeWalker,
    el: &IUIAutomationElement,
    depth: u32,
    max_depth: u32,
) -> TreeNodeDump {
    let mut children = Vec::new();
    if depth < max_depth {
        let mut child = walker.GetFirstChildElement(el).ok();
        while let Some(ref c) = child {
            children.push(build_dump(walker, c, depth + 1, max_depth));
            child = walker.GetNextSiblingElement(c).ok();
        }
    }
    TreeNodeDump {
        depth,
        name: element_name(el),
        control_type: control_type_name(element_control_type(el)),
        automation_id: element_automation_id(el),
        bounds: element_bounds(el),
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    }
}

pub fn dump_tree(root: A11yElementId, max_depth: u32) -> Result<String> {
    with_session(|s| {
        state::with_element(root, |stored| unsafe {
            let tree = build_dump(&s.walker, &stored.element, 0, max_depth);
            serde_json::to_string_pretty(&tree)
                .map_err(|e| SpotterError::Platform(format!("json: {e}")))
        })
    })
}

unsafe fn health_rec(
    walker: &IUIAutomationTreeWalker,
    el: &IUIAutomationElement,
    depth: u32,
    max_depth: u32,
    counts: &mut HashMap<String, u32>,
    list_items: &mut u32,
    edits: &mut u32,
    buttons: &mut u32,
    total: &mut u32,
    max_d: &mut u32,
) {
    *total += 1;
    *max_d = (*max_d).max(depth);
    let ct = control_type_name(element_control_type(el));
    *counts.entry(ct.clone()).or_insert(0) += 1;
    let cid = element_control_type(el);
    if cid == UIA_ListItemControlTypeId.0 {
        *list_items += 1;
    } else if cid == UIA_EditControlTypeId.0 {
        *edits += 1;
    } else if cid == UIA_ButtonControlTypeId.0 {
        *buttons += 1;
    }
    if depth >= max_depth {
        return;
    }
    let mut child = walker.GetFirstChildElement(el).ok();
    while let Some(ref c) = child {
        health_rec(
            walker, c, depth + 1, max_depth, counts, list_items, edits, buttons, total, max_d,
        );
        child = walker.GetNextSiblingElement(c).ok();
    }
}

pub fn tree_health(root: A11yElementId, max_depth: u32) -> Result<TreeHealth> {
    with_session(|s| {
        state::with_element(root, |stored| unsafe {
        let mut counts = HashMap::new();
        let mut list_items = 0;
        let mut edits = 0;
        let mut buttons = 0;
        let mut total = 0;
        let mut max_d = 0;
        health_rec(
            &s.walker,
            &stored.element,
            0,
            max_depth,
            &mut counts,
            &mut list_items,
            &mut edits,
            &mut buttons,
            &mut total,
            &mut max_d,
        );
            Ok(TreeHealth {
                max_depth: max_d,
                total_nodes: total,
                control_type_counts: counts,
                list_item_count: list_items,
                edit_count: edits,
                button_count: buttons,
            })
        })
    })
}

pub fn check_tree_health(root: A11yElementId, max_depth: u32, min_list_items: u32) -> Result<TreeHealth> {
    let h = tree_health(root, max_depth)?;
    if h.list_item_count < min_list_items && h.total_nodes < 5 {
        return Err(SpotterError::TreeUnavailable(format!(
            "thinned tree: list_items={}, total_nodes={}",
            h.list_item_count, h.total_nodes
        )));
    }
    Ok(h)
}
