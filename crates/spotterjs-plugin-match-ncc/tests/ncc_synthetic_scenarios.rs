//! Synthetic-image NCC regression scenarios (no live desktop / WeChat).
//!
//! Run: `cargo test -p spotterjs-plugin-match-ncc --test ncc_synthetic_scenarios`

mod common;

use common::fixtures::{self, Scenario};
use spotterjs_base::{MatchOptions, MatchPlugin, Region, SpotterError};
use spotterjs_plugin_match_ncc::NccMatcher;
use spotterjs_plugin_match_ncc::{find_best, find_best_serial, prepare_needle, rgba_to_gray};

fn assert_near(name: &str, found: &Region, expected: (i32, i32), tol: i32) {
    let dx = (found.left - expected.0).abs();
    let dy = (found.top - expected.1).abs();
    assert!(
        dx <= tol && dy <= tol,
        "{name}: expected ({}, {}), got ({}, {}), region={found:?}",
        expected.0,
        expected.1,
        found.left,
        found.top
    );
}

fn run_find(s: &Scenario) -> Region {
    NccMatcher
        .find(&s.hay, &s.needle, &s.opts)
        .map(|m| {
            assert!(m.score >= s.opts.confidence);
            m.region
        })
        .unwrap_or_else(|e| panic!("scenario {} failed: {e:?}", s.name))
}

fn fast_serial_agree(
    hay: &spotterjs_base::RgbaImage,
    needle: &spotterjs_base::RgbaImage,
    opts: &MatchOptions,
) {
    let hay_gray = rgba_to_gray(hay).expect("hay gray");
    let needle_gray = rgba_to_gray(needle).expect("needle gray");
    let prepared = prepare_needle(needle_gray, needle.width, needle.height);
    let (fast, fast_score) = find_best(hay, &hay_gray, &prepared, opts, None).expect("fast find");
    let (serial, serial_score) =
        find_best_serial(hay, &hay_gray, &prepared, opts, None).expect("serial find");
    assert_eq!(
        (fast.left, fast.top),
        (serial.left, serial.top),
        "fast=({},{}) score={fast_score} serial=({},{}) score={serial_score}",
        fast.left,
        fast.top,
        serial.left,
        serial.top
    );
}

#[test]
fn all_synthetic_scenarios_find() {
    for s in fixtures::build_find_scenarios() {
        let found = run_find(&s);
        assert_near(s.name, &found, s.expected, s.tol);
    }
}

#[test]
fn find_all_two_identical_patches() {
    let mut hay = fixtures::solid(100, 100, [20, 20, 20]);
    fixtures::paint_rect(&mut hay, 10, 10, 12, 12, [250, 0, 0]);
    fixtures::paint_rect(&mut hay, 70, 70, 12, 12, [250, 0, 0]);
    let needle = fixtures::crop_needle(&hay, 10, 10, 12, 12);
    let all = NccMatcher
        .find_all(&hay, &needle, &fixtures::default_opts())
        .expect("two hits");
    assert_eq!(all.len(), 2);
}

#[test]
fn find_all_three_in_row() {
    let mut hay = fixtures::solid(220, 80, [18, 18, 22]);
    for x in [20u32, 90, 160] {
        fixtures::paint_rect(&mut hay, x, 30, 14, 14, [255, 80, 0]);
    }
    let needle = fixtures::crop_needle(&hay, 20, 30, 14, 14);
    let all = NccMatcher
        .find_all(&hay, &needle, &fixtures::default_opts())
        .expect("three hits");
    assert_eq!(all.len(), 3);
}

#[test]
fn fast_path_matches_serial_on_scenarios() {
    for s in fixtures::build_find_scenarios() {
        if s.opts.multi_scale {
            continue;
        }
        fast_serial_agree(&s.hay, &s.needle, &s.opts);
    }
}

#[test]
fn exact_copy_scores_high() {
    let mut hay = fixtures::gradient_bg(256, 256);
    fixtures::paint_icon_block(&mut hay, 90, 110, 24);
    let needle = fixtures::crop_needle(&hay, 90, 110, 24, 24);
    let hay_gray = rgba_to_gray(&hay).unwrap();
    let needle_gray = rgba_to_gray(&needle).unwrap();
    let prepared = prepare_needle(needle_gray, needle.width, needle.height);
    let (_, score) = find_best_serial(&hay, &hay_gray, &prepared, &fixtures::default_opts(), None)
        .expect("serial at exact");
    assert!(
        score > 0.99,
        "exact position should score ~1.0, got {score}"
    );
}

#[test]
fn fails_when_confidence_impossible() {
    let mut hay = fixtures::solid(48, 48, [10, 10, 10]);
    fixtures::paint_rect(&mut hay, 8, 8, 10, 10, [200, 0, 0]);
    let needle = fixtures::crop_needle(&hay, 8, 8, 10, 10);
    let mut opts = fixtures::default_opts();
    opts.confidence = 1.01;
    let err = NccMatcher.find(&hay, &needle, &opts).unwrap_err();
    assert!(matches!(err, SpotterError::MatchNotFound { .. }));
}

#[test]
fn scenario_count_matches_manifest() {
    const EXPECTED: usize = 16;
    assert_eq!(
        fixtures::build_find_scenarios().len(),
        EXPECTED,
        "update EXPECTED when adding/removing scenarios"
    );
}
