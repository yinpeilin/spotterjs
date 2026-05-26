//! Pure Rust NCC benchmark (no screen capture).
//!
//! Usage: cargo run -p spotterjs-plugin-match-ncc --release --example bench_ncc -- HAY NEEDLE

use spotterjs_base::MatchOptions;
use spotterjs_base::MatchPlugin;
use spotterjs_core::load_rgba_from_path;
use spotterjs_plugin_match_ncc::NccMatcher;
use std::env;
use std::fs;
use std::path::Path;
use std::time::Instant;

#[derive(Clone)]
struct Config {
    hay_path: String,
    needle_path: String,
    runs: usize,
    warmup: usize,
    json_path: Option<String>,
}

struct Stats {
    min: f64,
    median: f64,
    p95: f64,
    mean: f64,
    stddev: f64,
    samples: Vec<f64>,
}

struct ResultRow {
    label: &'static str,
    stats: Stats,
}

fn bench(
    label: &str,
    hay: &spotterjs_base::RgbaImage,
    needle: &spotterjs_base::RgbaImage,
    opts: MatchOptions,
    config: &Config,
) -> Stats {
    let matcher = NccMatcher;
    for _ in 0..config.warmup {
        let _ = matcher.find(hay, needle, &opts).expect(label);
    }

    let mut samples = Vec::with_capacity(config.runs);
    for _ in 0..config.runs {
        let t0 = Instant::now();
        let _ = matcher.find(hay, needle, &opts).expect(label);
        samples.push(t0.elapsed().as_secs_f64() * 1000.0);
    }

    let stats = summarize(samples);
    println!(
        "{label}: mean={:.1} ms  median={:.1} ms  p95={:.1} ms  min={:.1} ms  stddev={:.1} ms",
        stats.mean, stats.median, stats.p95, stats.min, stats.stddev
    );
    stats
}

fn main() {
    let config = parse_args(env::args().skip(1).collect());
    if config.hay_path.is_empty() || config.needle_path.is_empty() {
        eprintln!("Usage: bench_ncc HAY.png NEEDLE.png [--runs N] [--warmup N] [--json PATH]");
        std::process::exit(1);
    }
    let hay = load_rgba_from_path(Path::new(&config.hay_path)).expect("load haystack");
    let needle = load_rgba_from_path(Path::new(&config.needle_path)).expect("load needle");
    println!(
        "hay {}x{}  needle {}x{}  runs={}  warmup={}\n",
        hay.width, hay.height, needle.width, needle.height, config.runs, config.warmup
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

    let rows = vec![
        ResultRow {
            label: "single scale",
            stats: bench("single scale", &hay, &needle, single, &config),
        },
        ResultRow {
            label: "multi-scale (9 steps)",
            stats: bench("multi-scale (9 steps)", &hay, &needle, multi, &config),
        },
    ];

    if let Some(json_path) = &config.json_path {
        fs::write(json_path, to_json(&config, &hay, &needle, &rows)).expect("write json");
    }
}

fn parse_args(args: Vec<String>) -> Config {
    let mut positionals = Vec::new();
    let mut runs = 15usize;
    let mut warmup = 3usize;
    let mut json_path = None;
    let mut i = 0;

    while i < args.len() {
        match args[i].as_str() {
            "--runs" => {
                i += 1;
                runs = parse_positive(args.get(i), "--runs");
            }
            "--warmup" => {
                i += 1;
                warmup = parse_nonnegative(args.get(i), "--warmup");
            }
            "--json" => {
                i += 1;
                json_path = Some(args.get(i).expect("missing --json value").clone());
            }
            value => positionals.push(value.to_string()),
        }
        i += 1;
    }

    Config {
        hay_path: positionals.get(0).cloned().unwrap_or_default(),
        needle_path: positionals.get(1).cloned().unwrap_or_default(),
        runs,
        warmup,
        json_path,
    }
}

fn parse_positive(value: Option<&String>, label: &str) -> usize {
    let parsed = value
        .unwrap_or_else(|| panic!("missing {label} value"))
        .parse::<usize>()
        .unwrap_or_else(|_| panic!("{label} must be a positive integer"));
    if parsed == 0 {
        panic!("{label} must be a positive integer");
    }
    parsed
}

fn parse_nonnegative(value: Option<&String>, label: &str) -> usize {
    value
        .unwrap_or_else(|| panic!("missing {label} value"))
        .parse::<usize>()
        .unwrap_or_else(|_| panic!("{label} must be a non-negative integer"))
}

fn summarize(mut samples: Vec<f64>) -> Stats {
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mean = samples.iter().sum::<f64>() / samples.len() as f64;
    let variance = samples
        .iter()
        .map(|sample| (sample - mean).powi(2))
        .sum::<f64>()
        / samples.len().saturating_sub(1).max(1) as f64;
    Stats {
        min: samples[0],
        median: percentile(&samples, 50.0),
        p95: percentile(&samples, 95.0),
        mean,
        stddev: variance.sqrt(),
        samples,
    }
}

fn percentile(samples: &[f64], p: f64) -> f64 {
    let idx = (((p / 100.0) * samples.len() as f64).ceil() as usize).saturating_sub(1);
    samples[idx.min(samples.len() - 1)]
}

fn to_json(
    config: &Config,
    hay: &spotterjs_base::RgbaImage,
    needle: &spotterjs_base::RgbaImage,
    rows: &[ResultRow],
) -> String {
    let mut out = String::new();
    out.push_str("{\n");
    out.push_str(&format!("  \"runs\": {},\n", config.runs));
    out.push_str(&format!("  \"warmup\": {},\n", config.warmup));
    out.push_str(&format!("  \"haystack\": {{ \"width\": {}, \"height\": {} }},\n", hay.width, hay.height));
    out.push_str(&format!("  \"needle\": {{ \"width\": {}, \"height\": {} }},\n", needle.width, needle.height));
    out.push_str("  \"results\": [\n");
    for (idx, row) in rows.iter().enumerate() {
        let comma = if idx + 1 == rows.len() { "" } else { "," };
        out.push_str(&format!(
            "    {{ \"label\": \"{}\", \"stats\": {{ \"min\": {:.4}, \"median\": {:.4}, \"p95\": {:.4}, \"mean\": {:.4}, \"stddev\": {:.4}, \"samples\": [{}] }} }}{}\n",
            row.label,
            row.stats.min,
            row.stats.median,
            row.stats.p95,
            row.stats.mean,
            row.stats.stddev,
            row.stats.samples.iter().map(|n| format!("{n:.4}")).collect::<Vec<_>>().join(", "),
            comma
        ));
    }
    out.push_str("  ]\n");
    out.push_str("}\n");
    out
}
