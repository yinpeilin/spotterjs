use crate::error::{Result, SpotterError};

pub fn clipboard_set(text: &str) -> Result<()> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| SpotterError::Platform(format!("clipboard init: {e}")))?;
    clipboard
        .set_text(text)
        .map_err(|e| SpotterError::Platform(format!("clipboard_set: {e}")))?;
    Ok(())
}

pub fn clipboard_get() -> Result<String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| SpotterError::Platform(format!("clipboard init: {e}")))?;
    clipboard
        .get_text()
        .map_err(|e| SpotterError::Platform(format!("clipboard_get: {e}")))
}
