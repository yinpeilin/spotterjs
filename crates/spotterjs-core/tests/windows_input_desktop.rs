#![cfg(windows)]

//! Regression for cursor operations after the caller loses the input desktop.
//! This creates a hidden desktop without displaying it, and only moves the
//! cursor back to its original position. It never clicks or types.

use spotterjs_core::{mouse_get_position, mouse_move, mouse_scroll_down};
use std::time::{SystemTime, UNIX_EPOCH};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{SetLastError, ERROR_ENVVAR_NOT_FOUND};
use windows::Win32::System::StationsAndDesktops::{
    CloseDesktop, CreateDesktopW, GetThreadDesktop, SetThreadDesktop, DESKTOP_CREATEWINDOW,
    DESKTOP_READOBJECTS, DESKTOP_WRITEOBJECTS,
};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;

#[test]
#[ignore = "requires an interactive Windows desktop"]
fn cursor_operations_recover_without_changing_the_callers_desktop() {
    // A fresh thread has no windows or hooks that would prevent desktop binding.
    std::thread::spawn(|| unsafe {
        let position = mouse_get_position().expect("read original cursor position");
        // GetThreadDesktop returns a borrowed handle. Only close the desktop
        // created below, after restoring this original binding.
        let original = GetThreadDesktop(GetCurrentThreadId()).expect("get original desktop");
        let name: Vec<u16> = format!(
            "spotter-cursor-regression-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock after Unix epoch")
                .as_nanos()
        )
        .encode_utf16()
        .chain(Some(0))
        .collect();
        let hidden = CreateDesktopW(
            PCWSTR(name.as_ptr()),
            PCWSTR::null(),
            None,
            Default::default(),
            DESKTOP_CREATEWINDOW.0 | DESKTOP_READOBJECTS.0 | DESKTOP_WRITEOBJECTS.0,
            None,
        )
        .expect("create hidden desktop");

        // Clean up the desktop even when a regression assertion panics.
        let outcome = std::panic::catch_unwind(|| {
            SetThreadDesktop(hidden).expect("bind test thread to hidden desktop");

            // SetCursorPos can fail without replacing last-error. This is the
            // misleading 0x800700CB seen by callers before the recovery path.
            SetLastError(ERROR_ENVVAR_NOT_FOUND);
            let error = SetCursorPos(position.0, position.1)
                .expect_err("raw SetCursorPos must fail outside the input desktop");
            eprintln!("raw SetCursorPos failure after seeding error 203: {error}");

            mouse_move(position.0, position.1)
                .expect("recover cursor movement through the input desktop");
            assert_eq!(
                GetThreadDesktop(GetCurrentThreadId()).expect("read caller desktop after move"),
                hidden,
                "movement recovery must preserve the host thread's desktop"
            );

            assert_eq!(
                mouse_get_position().expect("recover cursor read through the input desktop"),
                position
            );
            assert_eq!(
                GetThreadDesktop(GetCurrentThreadId()).expect("read caller desktop after query"),
                hidden,
                "position recovery must preserve the host thread's desktop"
            );

            // A zero-delta wheel event exercises the real SendInput recovery
            // path without scrolling the foreground application.
            mouse_scroll_down(0).expect("recover SendInput through the input desktop");
            assert_eq!(
                GetThreadDesktop(GetCurrentThreadId()).expect("read caller desktop after input"),
                hidden,
                "SendInput recovery must preserve the host thread's desktop"
            );
            assert_eq!(
                mouse_get_position().expect("read cursor after zero-delta input"),
                position,
                "zero-delta input must preserve the cursor position"
            );
        });

        let restore = SetThreadDesktop(original);
        let close = CloseDesktop(hidden);
        restore.expect("restore original desktop before closing the test desktop");
        close.expect("close owned hidden desktop");
        if let Err(panic) = outcome {
            std::panic::resume_unwind(panic);
        }
    })
    .join()
    .expect("cursor desktop regression worker");
}
