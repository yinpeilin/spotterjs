//! Desktop integration tests — run with `cargo test -p spotterjs-core -- --ignored`.

use spotterjs_core::{capture_screen, clipboard_get, clipboard_set, screen_size, SpotterError};

#[test]
#[ignore = "requires display and user session"]
fn clipboard_round_trip() {
    let token = format!("spotter-test-{}", std::process::id());
    clipboard_set(&token).expect("set clipboard");
    let read = clipboard_get().expect("get clipboard");
    assert_eq!(read, token);
}

#[test]
#[ignore = "requires display and user session"]
fn capture_screen_returns_pixels() {
    let img = capture_screen(None).expect("capture");
    assert!(img.width > 0);
    assert!(img.height > 0);
    assert_eq!(
        img.data.len(),
        (img.width * img.height * 4) as usize
    );
}

#[test]
#[ignore = "requires display and user session"]
fn screen_size_positive() {
    match screen_size() {
        Ok((w, h)) => {
            assert!(w > 0);
            assert!(h > 0);
        }
        Err(SpotterError::UnsupportedPlatform) => {}
        Err(e) => panic!("unexpected error: {e}"),
    }
}
