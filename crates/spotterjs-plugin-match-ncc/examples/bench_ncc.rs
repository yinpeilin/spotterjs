//! Pure Rust NCC benchmark (no screen capture).
//!
//! Usage: cargo run -p spotterjs-plugin-match-ncc --release --example bench_ncc -- HAY NEEDLE

use spotterjs_base::MatchOptions;
use spotterjs_base::MatchPlugin;
use spotterjs_core::load_rgba_from_path;
use spotterjs_plugin_match_ncc::NccMatcher;
use std::env;
use std::path::Path;
use std::time::Instant;

fn bench(
    label: &str,
    hay: &spotterjs_base::RgbaImage,
    needle: &spotterjs_base::RgbaImage,
    opts: MatchOptions,
) {
    let matcher = NccMatcher;
    let t0 = Instant::now();
    let _ = matcher.find(hay, needle, &opts).expect(label);
    let ms = t0.elapsed().as_secs_f64() * 1000.0;
    println!("{label}: {ms:.1} ms");
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: bench_ncc HAY.png NEEDLE.png");
        std::process::exit(1);
    }
    let hay = load_rgba_from_path(Path::new(&args[1])).expect("load haystack");
    let needle = load_rgba_from_path(Path::new(&args[2])).expect("load needle");
    println!(
        "hay {}x{}  needle {}x{}\n",
        hay.width, hay.height, needle.width, needle.height
    );

    let single = MatchOptions {
        confidence: 0.7,
        multi_scale: false,
        ..Default::default()
    };
    let multi = MatchOptions {
        confidence: 0.7,
        multi_scale: true,
        scale_min: 0.8,
        scale_max: 1.2,
        scale_step: 0.05,
        ..Default::default()
    };

    bench("single scale", &hay, &needle, single);
    bench("multi-scale (9 steps)", &hay, &needle, multi);
}
