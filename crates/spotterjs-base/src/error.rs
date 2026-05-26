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

impl SpotterError {
    pub fn code(&self) -> &'static str {
        match self {
            SpotterError::WindowNotFound(_) => "WINDOW_NOT_FOUND",
            SpotterError::FocusDenied { .. } => "FOCUS_DENIED",
            SpotterError::MatchNotFound { .. } => "MATCH_NOT_FOUND",
            SpotterError::MatchTimeout { .. } => "MATCH_TIMEOUT",
            SpotterError::CaptureFailed(_) => "CAPTURE_FAILED",
            SpotterError::InvalidWindowId(_) => "INVALID_WINDOW_ID",
            SpotterError::Platform(_) => "PLATFORM_ERROR",
            SpotterError::Io(_) => "IO_ERROR",
            SpotterError::Image(_) => "IMAGE_ERROR",
            SpotterError::UnsupportedPlatform => "UNSUPPORTED_PLATFORM",
            SpotterError::Plugin(_) => "PLUGIN_ERROR",
            SpotterError::AccessibilityDisabled => "ACCESSIBILITY_DISABLED",
            SpotterError::AccessibilityNotSupported => "ACCESSIBILITY_NOT_SUPPORTED",
            SpotterError::ElementNotFound(_) => "ELEMENT_NOT_FOUND",
            SpotterError::PatternNotSupported(_) => "PATTERN_NOT_SUPPORTED",
            SpotterError::TreeUnavailable(_) => "TREE_UNAVAILABLE",
        }
    }
}

pub type Result<T> = std::result::Result<T, SpotterError>;

#[cfg(test)]
mod tests {
    use super::SpotterError;

    #[test]
    fn exposes_stable_error_codes() {
        let cases = [
            (SpotterError::WindowNotFound("abc".into()), "WINDOW_NOT_FOUND"),
            (
                SpotterError::FocusDenied {
                    id: 1,
                    reason: "denied".into(),
                },
                "FOCUS_DENIED",
            ),
            (
                SpotterError::MatchNotFound { confidence: 0.9 },
                "MATCH_NOT_FOUND",
            ),
            (
                SpotterError::MatchTimeout { timeout_ms: 100 },
                "MATCH_TIMEOUT",
            ),
            (
                SpotterError::CaptureFailed("screen".into()),
                "CAPTURE_FAILED",
            ),
            (
                SpotterError::InvalidWindowId("bad".into()),
                "INVALID_WINDOW_ID",
            ),
            (SpotterError::Platform("api".into()), "PLATFORM_ERROR"),
            (SpotterError::Image("decode".into()), "IMAGE_ERROR"),
            (SpotterError::UnsupportedPlatform, "UNSUPPORTED_PLATFORM"),
            (SpotterError::Plugin("plugin".into()), "PLUGIN_ERROR"),
            (
                SpotterError::AccessibilityDisabled,
                "ACCESSIBILITY_DISABLED",
            ),
            (
                SpotterError::AccessibilityNotSupported,
                "ACCESSIBILITY_NOT_SUPPORTED",
            ),
            (
                SpotterError::ElementNotFound("element".into()),
                "ELEMENT_NOT_FOUND",
            ),
            (
                SpotterError::PatternNotSupported("invoke".into()),
                "PATTERN_NOT_SUPPORTED",
            ),
            (
                SpotterError::TreeUnavailable("root".into()),
                "TREE_UNAVAILABLE",
            ),
        ];

        for (error, code) in cases {
            assert_eq!(error.code(), code);
        }
    }
}
