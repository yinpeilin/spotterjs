use super::state::{self, store_element, update_element};
use super::types::{
    A11yBounds, A11yConfig, A11yElementId, A11yQuery, AttachCandidate, AttachReport, ElementInfo,
    TreeHealth, TreeNodeDump, TreeViewMode,
};
use super::uia_handler::create_structure_handler;
use crate::error::{Result, SpotterError};
use crate::types::{Region, WindowId};
use crate::window::get_active_window;
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use windows::core::BOOL;
use windows::core::BSTR;
use windows::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
use windows::Win32::Graphics::Gdi::ClientToScreen;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
};
use windows::Win32::System::Ole::{SafeArrayGetDim, SafeArrayGetElement};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationInvokePattern,
    IUIAutomationStructureChangedEventHandler, IUIAutomationTreeWalker, IUIAutomationValuePattern,
    TreeScope_Subtree, UIA_ButtonControlTypeId, UIA_CheckBoxControlTypeId,
    UIA_ComboBoxControlTypeId, UIA_CustomControlTypeId, UIA_DocumentControlTypeId,
    UIA_EditControlTypeId, UIA_ExpandCollapsePatternId, UIA_GroupControlTypeId,
    UIA_HyperlinkControlTypeId, UIA_ImageControlTypeId, UIA_InvokePatternId, UIA_ListControlTypeId,
    UIA_ListItemControlTypeId, UIA_MenuControlTypeId, UIA_MenuItemControlTypeId,
    UIA_PaneControlTypeId, UIA_RadioButtonControlTypeId, UIA_ScrollPatternId,
    UIA_SelectionPatternId, UIA_SliderControlTypeId, UIA_SpinnerControlTypeId,
    UIA_TabControlTypeId, UIA_TabItemControlTypeId, UIA_TextControlTypeId, UIA_TextPatternId,
    UIA_ToolBarControlTypeId, UIA_TreeControlTypeId, UIA_TreeItemControlTypeId, UIA_ValuePatternId,
    UIA_WindowControlTypeId, UIA_PATTERN_ID,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumChildWindows, GetClassNameW, GetClientRect, IsWindowVisible,
};

#[derive(Clone)]
pub struct StoredElement {
    pub element: IUIAutomationElement,
    pub attached_hwnd: HWND,
}

struct UiaSessionInner {
    automation: IUIAutomation,
    walker: IUIAutomationTreeWalker,
    control_walker: IUIAutomationTreeWalker,
    content_walker: IUIAutomationTreeWalker,
    active_tree_view: TreeViewMode,
    structure_handler: Option<IUIAutomationStructureChangedEventHandler>,
    handler_events: Option<std::sync::Arc<std::sync::atomic::AtomicU32>>,
    subscribed_hwnd: Option<HWND>,
}

thread_local! {
    static SESSION: RefCell<Option<UiaSessionInner>> = RefCell::new(None);
}

static CONFIG: Mutex<A11yConfig> = Mutex::new(A11yConfig {
    attach_delay_ms: 500,
    event_subscription: true,
    tree_wait_timeout_ms: 15_000,
    tree_wait_poll_ms: 300,
    min_list_item_count: 1,
    tree_view: TreeViewMode::Auto,
});

const MIN_CLIENT_AREA: i32 = 50;
const THIN_TREE_NODES: u32 = 5;

pub fn set_config(config: A11yConfig) {
    *CONFIG.lock().unwrap() = config;
}

fn config() -> A11yConfig {
    CONFIG.lock().unwrap().clone()
}

fn resolve_tree_view(cfg: &A11yConfig, client_mode: bool) -> TreeViewMode {
    match cfg.tree_view {
        TreeViewMode::Auto => {
            if client_mode {
                TreeViewMode::Control
            } else {
                TreeViewMode::Raw
            }
        }
        other => other,
    }
}

fn tree_view_label(mode: TreeViewMode) -> String {
    match mode {
        TreeViewMode::Auto => "auto".into(),
        TreeViewMode::Raw => "raw".into(),
        TreeViewMode::Control => "control".into(),
        TreeViewMode::Content => "content".into(),
    }
}

fn walker_for<'a>(
    session: &'a UiaSessionInner,
    override_mode: Option<TreeViewMode>,
) -> &'a IUIAutomationTreeWalker {
    let mode = override_mode.unwrap_or(session.active_tree_view);
    match mode {
        TreeViewMode::Raw => &session.walker,
        TreeViewMode::Control => &session.control_walker,
        TreeViewMode::Content => &session.content_walker,
        TreeViewMode::Auto => &session.walker,
    }
}

pub fn init_session() -> Result<()> {
    SESSION.with(|cell| {
        if cell.borrow().is_some() {
            return Ok(());
        }
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let automation: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_ALL)
                .map_err(|e| {
                    SpotterError::Platform(format!("CoCreateInstance(CUIAutomation): {e}"))
                })?;
            let walker = automation
                .RawViewWalker()
                .map_err(|e| SpotterError::Platform(format!("RawViewWalker: {e}")))?;
            let control_walker = automation
                .ControlViewWalker()
                .map_err(|e| SpotterError::Platform(format!("ControlViewWalker: {e}")))?;
            let content_walker = automation
                .ContentViewWalker()
                .map_err(|e| SpotterError::Platform(format!("ContentViewWalker: {e}")))?;
            *cell.borrow_mut() = Some(UiaSessionInner {
                automation,
                walker,
                control_walker,
                content_walker,
                active_tree_view: TreeViewMode::Raw,
                structure_handler: None,
                handler_events: None,
                subscribed_hwnd: None,
            });
        }
        Ok(())
    })
}

pub fn shutdown_session() {
    SESSION.with(|cell| {
        if let Some(mut session) = cell.borrow_mut().take() {
            unsafe {
                unregister_structure_handler(&mut session);
            }
        }
    });
    state::clear_registry();
}

fn with_session<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&UiaSessionInner) -> Result<T>,
{
    SESSION.with(|cell| {
        let guard = cell.borrow();
        let s = guard.as_ref().ok_or(SpotterError::AccessibilityDisabled)?;
        f(s)
    })
}

fn with_session_mut<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&mut UiaSessionInner) -> Result<T>,
{
    SESSION.with(|cell| {
        let mut guard = cell.borrow_mut();
        let s = guard.as_mut().ok_or(SpotterError::AccessibilityDisabled)?;
        f(s)
    })
}

fn hwnd_from_id(id: WindowId) -> HWND {
    HWND(id.0 as *mut std::ffi::c_void)
}

fn hwnd_to_u64(hwnd: HWND) -> u64 {
    hwnd.0 as usize as u64
}

unsafe fn element_from_hwnd(
    automation: &IUIAutomation,
    hwnd: HWND,
) -> Result<IUIAutomationElement> {
    automation
        .ElementFromHandle(hwnd)
        .map_err(|e| SpotterError::Platform(format!("ElementFromHandle: {e}")))
}

unsafe fn win32_class_name(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = GetClassNameW(hwnd, &mut buf);
    if len > 0 {
        String::from_utf16_lossy(&buf[..len as usize])
    } else {
        String::new()
    }
}

unsafe fn client_area_ok(hwnd: HWND) -> bool {
    if !IsWindowVisible(hwnd).as_bool() {
        return false;
    }
    let mut rect = RECT::default();
    if GetClientRect(hwnd, &mut rect).is_err() {
        return false;
    }
    let w = rect.right - rect.left;
    let h = rect.bottom - rect.top;
    w >= MIN_CLIENT_AREA && h >= MIN_CLIENT_AREA
}

unsafe fn enum_child_hwnds(parent: HWND, out: &mut Vec<HWND>) {
    unsafe extern "system" fn proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let out = &mut *(lparam.0 as *mut Vec<HWND>);
        if client_area_ok(hwnd) {
            out.push(hwnd);
            enum_child_hwnds(hwnd, out);
        }
        BOOL(1)
    }
    let _ = EnumChildWindows(Some(parent), Some(proc), LPARAM(out as *mut _ as _));
}

unsafe fn collect_hwnd_candidates(top: HWND) -> Vec<HWND> {
    let mut hwnds = Vec::new();
    if client_area_ok(top) {
        hwnds.push(top);
    }
    enum_child_hwnds(top, &mut hwnds);
    hwnds.sort_by_key(|h| hwnd_to_u64(*h));
    hwnds.dedup();
    hwnds
}

unsafe fn client_center_screen(hwnd: HWND) -> Option<POINT> {
    let mut rect = RECT::default();
    GetClientRect(hwnd, &mut rect).ok()?;
    let mut pt = POINT {
        x: rect.left + (rect.right - rect.left) / 2,
        y: rect.top + (rect.bottom - rect.top) / 2,
    };
    if !ClientToScreen(hwnd, &mut pt).as_bool() {
        return None;
    }
    Some(pt)
}

fn score_health(h: &TreeHealth) -> u32 {
    h.total_nodes + h.list_item_count * 10 + h.edit_count * 5 + h.button_count * 2
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
    if let (Some(ref handler), Some(hwnd)) = (&session.structure_handler, session.subscribed_hwnd) {
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
        .map_err(|e| SpotterError::Platform(format!("AddStructureChangedEventHandler: {e}")))?;
    session.structure_handler = Some(handler);
    session.handler_events = Some(count);
    session.subscribed_hwnd = Some(hwnd);
    Ok(true)
}

fn wait_for_tree_expand(
    hwnd: HWND,
    max_depth: u32,
    tree_view: TreeViewMode,
    initial: &TreeHealth,
) -> u64 {
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
                let walker = walker_for(sess, Some(tree_view));
                let h = tree_health_on_element(walker, &el, max_depth);
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

struct AttachSelection {
    hwnd: HWND,
    element: IUIAutomationElement,
    strategy: String,
    candidates: Vec<AttachCandidate>,
}

unsafe fn probe_hwnd_candidates(
    session: &UiaSessionInner,
    top_hwnd: HWND,
    max_depth: u32,
    walker: &IUIAutomationTreeWalker,
) -> Vec<(HWND, IUIAutomationElement, TreeHealth)> {
    let mut results = Vec::new();
    for hwnd in collect_hwnd_candidates(top_hwnd) {
        if let Ok(el) = element_from_hwnd(&session.automation, hwnd) {
            let health = tree_health_on_element(walker, &el, max_depth);
            results.push((hwnd, el, health));
        }
    }
    results
}

unsafe fn select_attach_target(
    session: &UiaSessionInner,
    top_hwnd: HWND,
    max_depth: u32,
    walker: &IUIAutomationTreeWalker,
) -> AttachSelection {
    let probes = probe_hwnd_candidates(session, top_hwnd, max_depth, walker);
    let mut best_idx = 0usize;
    let mut best_score = 0u32;
    for (i, (_, _, health)) in probes.iter().enumerate() {
        let score = score_health(health);
        if score > best_score {
            best_score = score;
            best_idx = i;
        }
    }

    let mut strategy = "top_level".to_string();
    let mut chosen_hwnd = top_hwnd;
    let mut chosen_el = probes
        .first()
        .map(|(_, el, _)| el.clone())
        .unwrap_or_else(|| {
            element_from_hwnd(&session.automation, top_hwnd)
                .unwrap_or_else(|_| panic!("top hwnd must resolve"))
        });

    if let Some((hwnd, el, _)) = probes.get(best_idx) {
        chosen_hwnd = *hwnd;
        chosen_el = el.clone();
        if *hwnd != top_hwnd {
            strategy = "child_hwnd".into();
        }
    }

    let mut candidates: Vec<AttachCandidate> = probes
        .iter()
        .enumerate()
        .map(|(i, (hwnd, _, health))| AttachCandidate {
            hwnd: hwnd_to_u64(*hwnd),
            class_name: win32_class_name(*hwnd),
            total_nodes: health.total_nodes,
            list_item_count: health.list_item_count,
            edit_count: health.edit_count,
            chosen: i == best_idx,
        })
        .collect();

    let best_health = probes
        .get(best_idx)
        .map(|(_, _, h)| h)
        .cloned()
        .unwrap_or(TreeHealth {
            max_depth: 0,
            total_nodes: 0,
            control_type_counts: HashMap::new(),
            list_item_count: 0,
            edit_count: 0,
            button_count: 0,
        });

    if best_health.total_nodes < THIN_TREE_NODES {
        if let Some(pt) = client_center_screen(top_hwnd) {
            if let Ok(el) = session.automation.ElementFromPoint(pt) {
                let health = tree_health_on_element(walker, &el, max_depth);
                if score_health(&health) > best_score {
                    if let Ok(native) = el.CurrentNativeWindowHandle() {
                        chosen_hwnd = native;
                    }
                    chosen_el = el;
                    strategy = "element_from_point".into();
                    for c in &mut candidates {
                        c.chosen = false;
                    }
                    candidates.push(AttachCandidate {
                        hwnd: hwnd_to_u64(chosen_hwnd),
                        class_name: win32_class_name(chosen_hwnd),
                        total_nodes: health.total_nodes,
                        list_item_count: health.list_item_count,
                        edit_count: health.edit_count,
                        chosen: true,
                    });
                }
            }
        }
    }

    AttachSelection {
        hwnd: chosen_hwnd,
        element: chosen_el,
        strategy,
        candidates,
    }
}

fn build_diagnosis(
    health: &TreeHealth,
    client_mode: bool,
    strategy: &str,
    candidates: &[AttachCandidate],
) -> Vec<String> {
    let mut d = Vec::new();
    if health.total_nodes >= THIN_TREE_NODES {
        return d;
    }
    if !client_mode {
        d.push("enable_event_subscription".into());
    }
    if strategy == "top_level" && candidates.len() > 1 {
        d.push("try_child_hwnd".into());
    }
    if health.total_nodes < THIN_TREE_NODES {
        d.push("increase_tree_wait".into());
    }
    d.push("fallback_template_matching".into());
    d
}

pub fn attach_window_report(id: WindowId, max_depth: u32) -> Result<AttachReport> {
    let top_hwnd = hwnd_from_id(id);
    if top_hwnd.0.is_null() {
        return Err(SpotterError::InvalidWindowId(id.to_hex()));
    }
    let cfg = config();
    let delay = cfg.attach_delay_ms;
    if delay > 0 {
        thread::sleep(Duration::from_millis(delay));
    }

    let client_mode = cfg.event_subscription;
    let active_tree_view = resolve_tree_view(&cfg, client_mode);

    let (selection, health_initial, event_handler_registered, should_wait) =
        with_session_mut(|session| unsafe {
            session.active_tree_view = active_tree_view;
            let walker = walker_for(session, Some(active_tree_view));
            let selection = select_attach_target(session, top_hwnd, max_depth, walker);
            let health_initial = tree_health_on_element(walker, &selection.element, max_depth);
            let event_handler_registered = if client_mode {
                register_structure_handler(session, selection.hwnd, &selection.element)
                    .unwrap_or(false)
            } else {
                false
            };
            let should_wait =
                client_mode && event_handler_registered && cfg.tree_wait_timeout_ms > 0;
            Ok((
                selection,
                health_initial,
                event_handler_registered,
                should_wait,
            ))
        })?;

    let tree_wait_ms = if should_wait {
        wait_for_tree_expand(selection.hwnd, max_depth, active_tree_view, &health_initial)
    } else {
        0
    };

    with_session_mut(|session| unsafe {
        let walker = walker_for(session, Some(active_tree_view));
        let element_final = element_from_hwnd(&session.automation, selection.hwnd)
            .unwrap_or(selection.element.clone());
        let health_final = tree_health_on_element(walker, &element_final, max_depth);

        let structure_events = session
            .handler_events
            .as_ref()
            .map(|c| c.load(std::sync::atomic::Ordering::Relaxed))
            .unwrap_or(0);

        let diagnosis = build_diagnosis(
            &health_final,
            client_mode,
            &selection.strategy,
            &selection.candidates,
        );

        let id_el = store_element(StoredElement {
            element: element_final,
            attached_hwnd: selection.hwnd,
        });

        Ok(AttachReport {
            element_id: id_el.0,
            client_mode,
            event_handler_registered,
            structure_changed_events: structure_events,
            health_initial,
            health_final,
            tree_wait_ms,
            attach_strategy: selection.strategy,
            attached_hwnd: hwnd_to_u64(selection.hwnd),
            tree_view: tree_view_label(active_tree_view),
            candidates: selection.candidates,
            diagnosis,
        })
    })
}

pub fn attach_window(id: WindowId) -> Result<A11yElementId> {
    Ok(A11yElementId(attach_window_report(id, 12)?.element_id))
}

pub fn attach_active() -> Result<A11yElementId> {
    let active = get_active_window()?;
    attach_window(active.id)
}

pub fn refresh_root(id: A11yElementId) -> Result<()> {
    with_session(|session| {
        state::with_element(id, |stored| unsafe {
            let fresh = element_from_hwnd(&session.automation, stored.attached_hwnd)?;
            update_element(
                id,
                StoredElement {
                    element: fresh,
                    attached_hwnd: stored.attached_hwnd,
                },
            );
            Ok(())
        })
    })
}

fn control_type_from_str(s: &str) -> Option<i32> {
    match s.trim().to_ascii_lowercase().as_str() {
        "listitem" | "list_item" => Some(UIA_ListItemControlTypeId.0 as i32),
        "menuitem" | "menu_item" => Some(UIA_MenuItemControlTypeId.0 as i32),
        "menu" => Some(UIA_MenuControlTypeId.0 as i32),
        "list" => Some(UIA_ListControlTypeId.0 as i32),
        "tab" => Some(UIA_TabControlTypeId.0 as i32),
        "tabitem" | "tab_item" => Some(UIA_TabItemControlTypeId.0 as i32),
        "checkbox" | "check_box" => Some(UIA_CheckBoxControlTypeId.0 as i32),
        "radiobutton" | "radio_button" => Some(UIA_RadioButtonControlTypeId.0 as i32),
        "combobox" | "combo_box" => Some(UIA_ComboBoxControlTypeId.0 as i32),
        "window" => Some(UIA_WindowControlTypeId.0 as i32),
        "toolbar" | "tool_bar" => Some(UIA_ToolBarControlTypeId.0 as i32),
        "tree" => Some(UIA_TreeControlTypeId.0 as i32),
        "treeitem" | "tree_item" => Some(UIA_TreeItemControlTypeId.0 as i32),
        "group" => Some(UIA_GroupControlTypeId.0 as i32),
        "image" => Some(UIA_ImageControlTypeId.0 as i32),
        "slider" => Some(UIA_SliderControlTypeId.0 as i32),
        "spinner" => Some(UIA_SpinnerControlTypeId.0 as i32),
        "hyperlink" | "hyper_link" => Some(UIA_HyperlinkControlTypeId.0 as i32),
        "custom" => Some(UIA_CustomControlTypeId.0 as i32),
        "button" => Some(UIA_ButtonControlTypeId.0 as i32),
        "edit" => Some(UIA_EditControlTypeId.0 as i32),
        "pane" => Some(UIA_PaneControlTypeId.0 as i32),
        "text" => Some(UIA_TextControlTypeId.0 as i32),
        "document" => Some(UIA_DocumentControlTypeId.0 as i32),
        _ => None,
    }
}

fn control_type_matches(actual: i32, expected_name: &str) -> bool {
    control_type_from_str(expected_name)
        .map(|expected| actual == expected)
        .unwrap_or(false)
}

fn control_type_name(id: i32) -> String {
    if id == UIA_ListItemControlTypeId.0 {
        "ListItem".into()
    } else if id == UIA_MenuItemControlTypeId.0 {
        "MenuItem".into()
    } else if id == UIA_MenuControlTypeId.0 {
        "Menu".into()
    } else if id == UIA_ListControlTypeId.0 {
        "List".into()
    } else if id == UIA_TabControlTypeId.0 {
        "Tab".into()
    } else if id == UIA_TabItemControlTypeId.0 {
        "TabItem".into()
    } else if id == UIA_CheckBoxControlTypeId.0 {
        "CheckBox".into()
    } else if id == UIA_RadioButtonControlTypeId.0 {
        "RadioButton".into()
    } else if id == UIA_ComboBoxControlTypeId.0 {
        "ComboBox".into()
    } else if id == UIA_WindowControlTypeId.0 {
        "Window".into()
    } else if id == UIA_ToolBarControlTypeId.0 {
        "ToolBar".into()
    } else if id == UIA_TreeControlTypeId.0 {
        "Tree".into()
    } else if id == UIA_TreeItemControlTypeId.0 {
        "TreeItem".into()
    } else if id == UIA_GroupControlTypeId.0 {
        "Group".into()
    } else if id == UIA_ImageControlTypeId.0 {
        "Image".into()
    } else if id == UIA_SliderControlTypeId.0 {
        "Slider".into()
    } else if id == UIA_SpinnerControlTypeId.0 {
        "Spinner".into()
    } else if id == UIA_HyperlinkControlTypeId.0 {
        "Hyperlink".into()
    } else if id == UIA_CustomControlTypeId.0 {
        "Custom".into()
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

unsafe fn runtime_id_string(el: &IUIAutomationElement) -> String {
    let Ok(sa) = el.GetRuntimeId() else {
        return String::new();
    };
    if sa.is_null() || SafeArrayGetDim(sa) == 0 {
        return String::new();
    }
    let mut parts = Vec::new();
    let mut i = 0i32;
    loop {
        let mut val = 0i32;
        if SafeArrayGetElement(sa, &i, &mut val as *mut _ as *mut _).is_err() {
            break;
        }
        parts.push(val.to_string());
        i += 1;
    }
    parts.join(".")
}

unsafe fn element_patterns(el: &IUIAutomationElement) -> Vec<String> {
    let checks: &[(i32, &str)] = &[
        (UIA_InvokePatternId.0, "Invoke"),
        (UIA_ValuePatternId.0, "Value"),
        (UIA_TextPatternId.0, "Text"),
        (UIA_ScrollPatternId.0, "Scroll"),
        (UIA_SelectionPatternId.0, "Selection"),
        (UIA_ExpandCollapsePatternId.0, "ExpandCollapse"),
    ];
    let mut out = Vec::new();
    for (pid, name) in checks {
        if el.GetCurrentPattern(UIA_PATTERN_ID(*pid)).is_ok() {
            out.push((*name).to_string());
        }
    }
    out
}

unsafe fn element_name(el: &IUIAutomationElement) -> String {
    el.CurrentName().map(|b| b.to_string()).unwrap_or_default()
}

unsafe fn element_control_type(el: &IUIAutomationElement) -> i32 {
    el.CurrentControlType().map(|c| c.0).unwrap_or(0)
}

unsafe fn element_automation_id(el: &IUIAutomationElement) -> String {
    el.CurrentAutomationId()
        .map(|b| b.to_string())
        .unwrap_or_default()
}

unsafe fn element_class_name(el: &IUIAutomationElement) -> String {
    el.CurrentClassName()
        .map(|b| b.to_string())
        .unwrap_or_default()
}

unsafe fn element_framework_id(el: &IUIAutomationElement) -> String {
    el.CurrentFrameworkId()
        .map(|b| b.to_string())
        .unwrap_or_default()
}

unsafe fn element_is_offscreen(el: &IUIAutomationElement) -> bool {
    el.CurrentIsOffscreen()
        .map(|b| b.as_bool())
        .unwrap_or(false)
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

unsafe fn element_info_from(el: &IUIAutomationElement) -> ElementInfo {
    ElementInfo {
        name: element_name(el),
        control_type: control_type_name(element_control_type(el)),
        automation_id: element_automation_id(el),
        class_name: element_class_name(el),
        framework_id: element_framework_id(el),
        runtime_id: runtime_id_string(el),
        is_offscreen: element_is_offscreen(el),
        patterns: element_patterns(el),
        bounds: element_bounds(el),
    }
}

pub fn get_element_info(id: A11yElementId) -> Result<ElementInfo> {
    state::with_element(id, |stored| unsafe {
        Ok(element_info_from(&stored.element))
    })
}

unsafe fn matches_query(el: &IUIAutomationElement, query: &A11yQuery) -> bool {
    if let Some(ref ct) = query.control_type {
        if !control_type_matches(element_control_type(el), ct) {
            return false;
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
            let walker = walker_for(s, None);
            let found = find_rec(walker, &stored.element, query, 0, max_depth)?;
            Ok(store_element(StoredElement {
                element: found,
                attached_hwnd: stored.attached_hwnd,
            }))
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
        let b = element_bounds(&stored.element)
            .ok_or_else(|| SpotterError::Platform("no bounding rectangle".into()))?;
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
    let info = element_info_from(el);
    TreeNodeDump {
        depth,
        name: info.name,
        control_type: info.control_type,
        automation_id: info.automation_id,
        class_name: info.class_name,
        framework_id: info.framework_id,
        runtime_id: info.runtime_id,
        is_offscreen: info.is_offscreen,
        patterns: info.patterns,
        bounds: info.bounds,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    }
}

pub fn dump_tree_node(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeNodeDump> {
    with_session(|s| {
        state::with_element(root, |stored| unsafe {
            let walker = walker_for(s, tree_view);
            Ok(build_dump(walker, &stored.element, 0, max_depth))
        })
    })
}

pub fn dump_tree(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<String> {
    let tree = dump_tree_node(root, max_depth, tree_view)?;
    serde_json::to_string_pretty(&tree).map_err(|e| SpotterError::Platform(format!("json: {e}")))
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
            walker,
            c,
            depth + 1,
            max_depth,
            counts,
            list_items,
            edits,
            buttons,
            total,
            max_d,
        );
        child = walker.GetNextSiblingElement(c).ok();
    }
}

pub fn tree_health(
    root: A11yElementId,
    max_depth: u32,
    tree_view: Option<TreeViewMode>,
) -> Result<TreeHealth> {
    with_session(|s| {
        state::with_element(root, |stored| unsafe {
            let walker = walker_for(s, tree_view);
            let mut counts = HashMap::new();
            let mut list_items = 0;
            let mut edits = 0;
            let mut buttons = 0;
            let mut total = 0;
            let mut max_d = 0;
            health_rec(
                walker,
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

pub fn check_tree_health(
    root: A11yElementId,
    max_depth: u32,
    min_list_items: u32,
) -> Result<TreeHealth> {
    let h = tree_health(root, max_depth, None)?;
    if h.list_item_count < min_list_items && h.total_nodes < THIN_TREE_NODES {
        return Err(SpotterError::TreeUnavailable(format!(
            "thinned tree: list_items={}, total_nodes={}",
            h.list_item_count, h.total_nodes
        )));
    }
    Ok(h)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_config_replaces_existing_config() {
        let mut first = A11yConfig::default();
        first.attach_delay_ms = 111;
        first.tree_wait_timeout_ms = 222;
        first.tree_view = TreeViewMode::Raw;

        let mut second = A11yConfig::default();
        second.attach_delay_ms = 333;
        second.tree_wait_timeout_ms = 444;
        second.tree_view = TreeViewMode::Content;

        set_config(first);
        set_config(second);

        let actual = config();
        assert_eq!(actual.attach_delay_ms, 333);
        assert_eq!(actual.tree_wait_timeout_ms, 444);
        assert_eq!(actual.tree_view, TreeViewMode::Content);
    }

    #[test]
    fn maps_common_control_type_names() {
        let cases = [
            ("Menu", UIA_MenuControlTypeId.0),
            ("List", UIA_ListControlTypeId.0),
            ("Tab", UIA_TabControlTypeId.0),
            ("TabItem", UIA_TabItemControlTypeId.0),
            ("CheckBox", UIA_CheckBoxControlTypeId.0),
            ("RadioButton", UIA_RadioButtonControlTypeId.0),
            ("ComboBox", UIA_ComboBoxControlTypeId.0),
            ("Window", UIA_WindowControlTypeId.0),
            ("ToolBar", UIA_ToolBarControlTypeId.0),
            ("Tree", UIA_TreeControlTypeId.0),
            ("TreeItem", UIA_TreeItemControlTypeId.0),
            ("Group", UIA_GroupControlTypeId.0),
            ("Image", UIA_ImageControlTypeId.0),
            ("Slider", UIA_SliderControlTypeId.0),
            ("Spinner", UIA_SpinnerControlTypeId.0),
            ("Hyperlink", UIA_HyperlinkControlTypeId.0),
            ("Custom", UIA_CustomControlTypeId.0),
        ];

        for (name, expected) in cases {
            assert_eq!(control_type_from_str(name), Some(expected), "{name}");
        }
    }

    #[test]
    fn unknown_control_type_matches_nothing() {
        assert!(control_type_matches(UIA_ButtonControlTypeId.0, "Button"));
        assert!(!control_type_matches(
            UIA_ButtonControlTypeId.0,
            "DefinitelyUnknown"
        ));
    }
}
