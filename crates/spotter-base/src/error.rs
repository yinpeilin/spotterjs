use thiserror::Error;

#[derive(Debug, Error)]
pub enum SpotterError {
    #[error("window not found: {0}")]
    WindowNotFound(String),

    #[error("focus denied for window {id}: {reason}")]
    FocusDenied { id: u64, reason: String },

    #[error("image match not found (confidence >= {confidence})")]
    MatchNotFound { confidence: f64 },

    #[error("image match timed out after {timeout_ms}ms")]
    MatchTimeout { timeout_ms: u64 },

    #[error("capture failed: {0}")]
    CaptureFailed(String),

    #[error("invalid window id: {0}")]
    InvalidWindowId(String),

    #[error("platform error: {0}")]
    Platform(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("image error: {0}")]
    Image(String),

    #[error("unsupported platform")]
    UnsupportedPlatform,

    #[error("plugin error: {0}")]
    Plugin(String),

    #[error("accessibility is disabled; call enable() first")]
    AccessibilityDisabled,

    #[error("accessibility not supported on this platform")]
    AccessibilityNotSupported,

    #[error("accessibility element not found: {0}")]
    ElementNotFound(String),

    #[error("accessibility pattern not supported: {0}")]
    PatternNotSupported(String),

    #[error("accessibility tree unavailable or thinned: {0}")]
    TreeUnavailable(String),
}

pub type Result<T> = std::result::Result<T, SpotterError>;
