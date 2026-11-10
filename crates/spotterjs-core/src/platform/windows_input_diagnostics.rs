//! Read-only diagnostics sampled on the actual native input caller's thread.

use super::windows_input::InputDesktop;
use serde_json::{json, Value};
use windows::Win32::Foundation::{SetLastError, ERROR_SUCCESS, HANDLE, HWND};
use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
use windows::Win32::System::StationsAndDesktops::{
    GetProcessWindowStation, GetThreadDesktop, GetUserObjectInformationW, OpenInputDesktop,
    DESKTOP_CONTROL_FLAGS, DESKTOP_READOBJECTS, UOI_NAME,
};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

fn record<T, E: std::fmt::Display>(
    field: &str,
    result: std::result::Result<T, E>,
    errors: &mut Vec<Value>,
) -> Option<T> {
    match result {
        Ok(value) => Some(value),
        Err(error) => {
            errors.push(json!({ "field": field, "error": error.to_string() }));
            None
        }
    }
}

fn object_name(handle: HANDLE) -> windows::core::Result<String> {
    unsafe {
        let mut bytes = 0;
        // The first call obtains the required buffer size in bytes.
        let size_result = GetUserObjectInformationW(handle, UOI_NAME, None, 0, Some(&mut bytes));
        if bytes == 0 {
            size_result?;
            return Ok(String::new());
        }
        let mut buffer = vec![0u16; (bytes as usize).div_ceil(2)];
        GetUserObjectInformationW(
            handle,
            UOI_NAME,
            Some(buffer.as_mut_ptr().cast()),
            bytes,
            None,
        )?;
        let end = buffer
            .iter()
            .position(|&unit| unit == 0)
            .unwrap_or(buffer.len());
        Ok(String::from_utf16_lossy(&buffer[..end]))
    }
}

fn session_id(process_id: u32) -> windows::core::Result<u32> {
    let mut session = 0;
    unsafe { ProcessIdToSessionId(process_id, &mut session)? };
    Ok(session)
}

/// Read the caller's desktop and session without moving, clicking, or binding.
/// Each failed field remains null with its cause in `errors`. A matching name
/// is a snapshot, not proof that input permissions are sufficient.
pub(super) fn snapshot() -> Value {
    let mut errors = Vec::new();
    let process_id = std::process::id();
    let thread_id = unsafe { GetCurrentThreadId() };
    let session = record("sessionId", session_id(process_id), &mut errors);
    let station = record(
        "windowStation",
        unsafe { GetProcessWindowStation() }.and_then(|handle| object_name(HANDLE(handle.0))),
        &mut errors,
    );
    let thread_desktop = record(
        "threadDesktop",
        unsafe { GetThreadDesktop(thread_id) }.and_then(|handle| object_name(HANDLE(handle.0))),
        &mut errors,
    );
    let input_desktop = record(
        "inputDesktop",
        unsafe { OpenInputDesktop(DESKTOP_CONTROL_FLAGS::default(), false, DESKTOP_READOBJECTS) }
            .and_then(|handle| {
                let owned = InputDesktop(handle);
                object_name(HANDLE((owned.0).0))
            }),
        &mut errors,
    );
    let matches = thread_desktop
        .as_ref()
        .zip(input_desktop.as_ref())
        .map(|(caller, input)| caller == input);

    let foreground = unsafe { GetForegroundWindow() };
    let foreground_window = if foreground == HWND::default() {
        Value::Null
    } else {
        let mut pid = 0;
        let tid = unsafe {
            SetLastError(ERROR_SUCCESS);
            GetWindowThreadProcessId(foreground, Some(&mut pid))
        };
        if tid == 0 || pid == 0 {
            errors.push(json!({
                "field": "foregroundWindow",
                "error": format!("GetWindowThreadProcessId failed: {}", std::io::Error::last_os_error()),
            }));
            Value::Null
        } else {
            let foreground_session =
                record("foregroundWindow.sessionId", session_id(pid), &mut errors);
            json!({
                "windowId": (foreground.0 as usize).to_string(),
                "processId": pid,
                "threadId": tid,
                "sessionId": foreground_session,
                "sameSessionAsCaller": session.zip(foreground_session).map(|(a, b)| a == b),
            })
        }
    };

    json!({
        "timestampMs": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .ok().map(|value| value.as_millis() as u64),
        "processId": process_id,
        "threadId": thread_id,
        "sessionId": session,
        "windowStation": station,
        "windowStationIsInteractive": station.as_ref().map(|name| name.eq_ignore_ascii_case("WinSta0")),
        "threadDesktop": thread_desktop,
        "inputDesktop": input_desktop,
        "threadDesktopMatchesInput": matches,
        "foregroundWindow": foreground_window,
        "errors": errors,
    })
}
