use serde::Serialize;
use serde_json::{json, Value};
use thiserror::Error;

pub const SPOTTER_ERROR_JSON_PREFIX: &str = "SPOTTER_ERROR_JSON:";

#[derive(Debug, Serialize)]
pub struct SpotterErrorPayload {
    pub code: &'static str,
    pub message: String,
    pub domain: &'static str,
    pub context: Value,
}

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
            SpotterError::WindowNotFound(_) => "SPOTTER_NATIVE_WINDOW_NOT_FOUND",
            SpotterError::FocusDenied { .. } => "SPOTTER_NATIVE_FOCUS_DENIED",
            SpotterError::MatchNotFound { .. } => "SPOTTER_NATIVE_MATCH_NOT_FOUND",
            SpotterError::MatchTimeout { .. } => "SPOTTER_NATIVE_MATCH_TIMEOUT",
            SpotterError::CaptureFailed(_) => "SPOTTER_NATIVE_CAPTURE_FAILED",
            SpotterError::InvalidWindowId(_) => "SPOTTER_NATIVE_INVALID_WINDOW_ID",
            SpotterError::Platform(_) => "SPOTTER_NATIVE_PLATFORM_ERROR",
            SpotterError::Io(_) => "SPOTTER_NATIVE_IO_ERROR",
            SpotterError::Image(_) => "SPOTTER_NATIVE_IMAGE_ERROR",
            SpotterError::UnsupportedPlatform => "SPOTTER_NATIVE_UNSUPPORTED_PLATFORM",
            SpotterError::Plugin(_) => "SPOTTER_NATIVE_PLUGIN_ERROR",
            SpotterError::AccessibilityDisabled => "SPOTTER_NATIVE_ACCESSIBILITY_DISABLED",
            SpotterError::AccessibilityNotSupported => {
                "SPOTTER_NATIVE_ACCESSIBILITY_NOT_SUPPORTED"
            }
            SpotterError::ElementNotFound(_) => "SPOTTER_NATIVE_ELEMENT_NOT_FOUND",
            SpotterError::PatternNotSupported(_) => "SPOTTER_NATIVE_PATTERN_NOT_SUPPORTED",
            SpotterError::TreeUnavailable(_) => "SPOTTER_NATIVE_TREE_UNAVAILABLE",
        }
    }

    pub fn context(&self) -> Value {
        match self {
            SpotterError::WindowNotFound(window) => json!({ "window": window }),
            SpotterError::FocusDenied { id, reason } => {
                json!({ "windowId": id, "reason": reason })
            }
            SpotterError::MatchNotFound { confidence } => json!({ "confidence": confidence }),
            SpotterError::MatchTimeout { timeout_ms } => json!({ "timeoutMs": timeout_ms }),
            SpotterError::CaptureFailed(reason) => json!({ "reason": reason }),
            SpotterError::InvalidWindowId(window_id) => json!({ "windowId": window_id }),
            SpotterError::Platform(reason) => json!({ "reason": reason }),
            SpotterError::Io(error) => {
                json!({ "kind": format!("{:?}", error.kind()), "reason": error.to_string() })
            }
            SpotterError::Image(reason) => json!({ "reason": reason }),
            SpotterError::UnsupportedPlatform => {
                json!({ "platform": std::env::consts::OS, "arch": std::env::consts::ARCH })
            }
            SpotterError::Plugin(reason) => json!({ "reason": reason }),
            SpotterError::AccessibilityDisabled => json!({}),
            SpotterError::AccessibilityNotSupported => {
                json!({ "platform": std::env::consts::OS, "arch": std::env::consts::ARCH })
            }
            SpotterError::ElementNotFound(element) => json!({ "element": element }),
            SpotterError::PatternNotSupported(pattern) => json!({ "pattern": pattern }),
            SpotterError::TreeUnavailable(reason) => json!({ "reason": reason }),
        }
    }

    pub fn payload(&self) -> SpotterErrorPayload {
        SpotterErrorPayload {
            code: self.code(),
            message: self.to_string(),
            domain: "native",
            context: self.context(),
        }
    }

    pub fn to_napi_message(&self) -> String {
        match serde_json::to_string(&self.payload()) {
            Ok(payload) => format!("{SPOTTER_ERROR_JSON_PREFIX}{payload}"),
            Err(_) => format!(
                "{SPOTTER_ERROR_JSON_PREFIX}{{\"code\":\"{}\",\"message\":\"{}\",\"domain\":\"native\",\"context\":{{}}}}",
                self.code(),
                self.to_string().replace('"', "\\\"")
            ),
        }
    }
}

pub type Result<T> = std::result::Result<T, SpotterError>;

#[cfg(test)]
mod tests {
    use super::SpotterError;
    use serde_json::json;

    #[test]
    fn exposes_unified_native_error_codes() {
        let cases = [
            (
                SpotterError::WindowNotFound("abc".into()),
                "SPOTTER_NATIVE_WINDOW_NOT_FOUND",
            ),
            (
                SpotterError::FocusDenied {
                    id: 1,
                    reason: "denied".into(),
                },
                "SPOTTER_NATIVE_FOCUS_DENIED",
            ),
            (
                SpotterError::MatchNotFound { confidence: 0.9 },
                "SPOTTER_NATIVE_MATCH_NOT_FOUND",
            ),
            (
                SpotterError::MatchTimeout { timeout_ms: 100 },
                "SPOTTER_NATIVE_MATCH_TIMEOUT",
            ),
            (
                SpotterError::CaptureFailed("screen".into()),
                "SPOTTER_NATIVE_CAPTURE_FAILED",
            ),
            (
                SpotterError::InvalidWindowId("bad".into()),
                "SPOTTER_NATIVE_INVALID_WINDOW_ID",
            ),
            (
                SpotterError::Platform("api".into()),
                "SPOTTER_NATIVE_PLATFORM_ERROR",
            ),
            (
                SpotterError::Image("decode".into()),
                "SPOTTER_NATIVE_IMAGE_ERROR",
            ),
            (
                SpotterError::UnsupportedPlatform,
                "SPOTTER_NATIVE_UNSUPPORTED_PLATFORM",
            ),
            (
                SpotterError::Plugin("plugin".into()),
                "SPOTTER_NATIVE_PLUGIN_ERROR",
            ),
            (
                SpotterError::AccessibilityDisabled,
                "SPOTTER_NATIVE_ACCESSIBILITY_DISABLED",
            ),
            (
                SpotterError::AccessibilityNotSupported,
                "SPOTTER_NATIVE_ACCESSIBILITY_NOT_SUPPORTED",
            ),
            (
                SpotterError::ElementNotFound("element".into()),
                "SPOTTER_NATIVE_ELEMENT_NOT_FOUND",
            ),
            (
                SpotterError::PatternNotSupported("invoke".into()),
                "SPOTTER_NATIVE_PATTERN_NOT_SUPPORTED",
            ),
            (
                SpotterError::TreeUnavailable("root".into()),
                "SPOTTER_NATIVE_TREE_UNAVAILABLE",
            ),
        ];

        for (error, code) in cases {
            assert_eq!(error.code(), code);
        }
    }

    #[test]
    fn exposes_structured_context() {
        assert_eq!(
            SpotterError::FocusDenied {
                id: 42,
                reason: "foreground lock".into(),
            }
            .context(),
            json!({ "windowId": 42, "reason": "foreground lock" })
        );
        assert_eq!(
            SpotterError::MatchTimeout { timeout_ms: 500 }.context(),
            json!({ "timeoutMs": 500 })
        );
        assert_eq!(
            SpotterError::AccessibilityDisabled.context(),
            json!({})
        );
    }

    #[test]
    fn serializes_napi_payload_in_message() {
        let message = SpotterError::MatchNotFound { confidence: 0.95 }.to_napi_message();
        let payload = message
            .strip_prefix("SPOTTER_ERROR_JSON:")
            .expect("message should use spotter JSON prefix");
        let parsed: serde_json::Value = serde_json::from_str(payload).expect("valid JSON");

        assert_eq!(parsed["code"], "SPOTTER_NATIVE_MATCH_NOT_FOUND");
        assert_eq!(parsed["domain"], "native");
        assert_eq!(parsed["context"], json!({ "confidence": 0.95 }));
        assert_eq!(
            parsed["message"],
            "image match not found (confidence >= 0.95)"
        );
    }
}
