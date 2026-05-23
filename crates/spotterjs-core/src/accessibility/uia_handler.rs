//! COM callback so WeChat / other apps see a real UIA client (StructureChanged subscription).

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use windows::core::implement;
use windows::Win32::System::Com::SAFEARRAY;
use windows::Win32::UI::Accessibility::{
    IUIAutomationElement, IUIAutomationStructureChangedEventHandler,
    IUIAutomationStructureChangedEventHandler_Impl, StructureChangeType,
};

#[implement(IUIAutomationStructureChangedEventHandler)]
struct StructureChangedHandler(Arc<AtomicU32>);

impl StructureChangedHandler {
    fn new() -> Self {
        Self(Arc::new(AtomicU32::new(0)))
    }

    fn count(&self) -> Arc<AtomicU32> {
        self.0.clone()
    }
}

impl IUIAutomationStructureChangedEventHandler_Impl for StructureChangedHandler_Impl {
    fn HandleStructureChangedEvent(
        &self,
        _sender: windows::core::Ref<'_, IUIAutomationElement>,
        _changetype: StructureChangeType,
        _runtimeid: *const SAFEARRAY,
    ) -> windows::core::Result<()> {
        self.0.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }
}

pub fn create_structure_handler() -> (IUIAutomationStructureChangedEventHandler, Arc<AtomicU32>) {
    let handler = StructureChangedHandler::new();
    let count = handler.count();
    (handler.into(), count)
}
