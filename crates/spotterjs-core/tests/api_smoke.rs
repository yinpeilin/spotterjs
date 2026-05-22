use spotterjs_core::{region_center, screen_size, Region, SpotterError};

#[test]
fn region_center_computes_midpoint() {
    let r = Region {
        left: 10,
        top: 20,
        width: 100,
        height: 50,
    };
    let (x, y) = region_center(r);
    assert_eq!(x, 60);
    assert_eq!(y, 45);
}

#[test]
fn screen_size_or_unsupported() {
    match screen_size() {
        Ok((w, h)) => {
            assert!(w > 0);
            assert!(h > 0);
        }
        Err(SpotterError::UnsupportedPlatform) => {}
        Err(e) => panic!("unexpected error: {e}"),
    }
}
