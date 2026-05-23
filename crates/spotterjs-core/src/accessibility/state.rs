use super::types::A11yElementId;
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

static ENABLED: AtomicBool = AtomicBool::new(false);

static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

#[cfg(windows)]
thread_local! {
    static REGISTRY: RefCell<HashMap<u64, crate::accessibility::windows::StoredElement>> =
        RefCell::new(HashMap::new());
}

#[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
thread_local! {
    static REGISTRY_LINUX: RefCell<HashMap<u64, crate::accessibility::linux::StoredElement>> =
        RefCell::new(HashMap::new());
}

pub fn is_enabled() -> bool {
    ENABLED.load(Ordering::SeqCst)
}

pub fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn require_enabled() -> crate::error::Result<()> {
    if is_enabled() {
        Ok(())
    } else {
        Err(crate::error::SpotterError::AccessibilityDisabled)
    }
}

#[cfg(windows)]
pub fn store_element(el: crate::accessibility::windows::StoredElement) -> A11yElementId {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    REGISTRY.with(|r| r.borrow_mut().insert(id, el));
    A11yElementId(id)
}

#[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
pub fn store_element_linux(el: crate::accessibility::linux::StoredElement) -> A11yElementId {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    REGISTRY_LINUX.with(|r| r.borrow_mut().insert(id, el));
    A11yElementId(id)
}

#[cfg(windows)]
pub fn with_element<
    T,
    F: FnOnce(&crate::accessibility::windows::StoredElement) -> crate::error::Result<T>,
>(
    id: A11yElementId,
    f: F,
) -> crate::error::Result<T> {
    let el = REGISTRY.with(|r| {
        let reg = r.borrow();
        reg.get(&id.0).cloned().ok_or_else(|| {
            crate::error::SpotterError::ElementNotFound(format!("element id {}", id.0))
        })
    })?;
    f(&el)
}

#[cfg(windows)]
pub fn update_element(id: A11yElementId, el: crate::accessibility::windows::StoredElement) {
    REGISTRY.with(|r| {
        r.borrow_mut().insert(id.0, el);
    });
}

#[cfg(windows)]
pub fn clear_registry() {
    REGISTRY.with(|r| r.borrow_mut().clear());
}

#[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
pub fn with_element_linux<
    T,
    F: FnOnce(&crate::accessibility::linux::StoredElement) -> crate::error::Result<T>,
>(
    id: A11yElementId,
    f: F,
) -> crate::error::Result<T> {
    let el = REGISTRY_LINUX.with(|r| {
        let reg = r.borrow();
        reg.get(&id.0).cloned().ok_or_else(|| {
            crate::error::SpotterError::ElementNotFound(format!("element id {}", id.0))
        })
    })?;
    f(&el)
}

#[cfg(all(target_os = "linux", feature = "accessibility-linux"))]
pub fn clear_registry_linux() {
    REGISTRY_LINUX.with(|r| r.borrow_mut().clear());
}

pub fn element_id_to_string(id: A11yElementId) -> String {
    id.0.to_string()
}

pub fn element_id_from_string(s: &str) -> crate::error::Result<A11yElementId> {
    let n: u64 = s
        .parse()
        .map_err(|_| crate::error::SpotterError::ElementNotFound(format!("invalid id: {s}")))?;
    Ok(A11yElementId(n))
}
