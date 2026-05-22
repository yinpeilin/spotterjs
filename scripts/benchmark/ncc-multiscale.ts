/**
 * Benchmark NCC find with optional multi-scale.
 * Fixtures: test-output/needle.png (from smoke capture).
 *
 * Usage:
 *   npm run benchmark:ncc
 *   npm run benchmark:ncc -- --runs 20 --warmup 3
 */
import * as fs from "fs";
import * as path from "path";
import { screen } from "@spotterjs/core";

const outDir = path.resolve(process.cwd(), "test-output");
const needlePath = path.join(outDir, "needle.png");

function parseArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const WARMUP = parseArg("--warmup", 3);
const RUNS = parseArg("--runs", 15);

interface Stats {
  min: number;
  median: number;
  p95: number;
  mean: number;
  stddev: number;
  samples: number[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(times: number[]): Stats {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance =
    times.reduce((acc, t) => acc + (t - mean) ** 2, 0) / Math.max(1, times.length - 1);
  return {
    min: sorted[0],
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    mean,
    stddev: Math.sqrt(variance),
    samples: sorted,
  };
}

function fmtStats(s: Stats): string {
  return [
    `mean=${s.mean.toFixed(1)} ms`,
    `median=${s.median.toFixed(1)} ms`,
    `min=${s.min.toFixed(1)} ms`,
    `p95=${s.p95.toFixed(1)} ms`,
    `σ=${s.stddev.toFixed(1)} ms`,
  ].join("  ");
}

async function benchScenario(
  label: string,
  fn: () => Promise<unknown>,
  warmup: number,
  runs: number
): Promise<Stats> {
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  const stats = summarize(times);
  console.log(`${label}  (${runs} runs, ${warmup} warmup)`);
  console.log(`  ${fmtStats(stats)}`);
  console.log(
    `  runs: ${stats.samples.map((t) => t.toFixed(1)).join(", ")} ms\n`
  );
  return stats;
}

async function main(): Promise<void> {
  if (!fs.existsSync(needlePath)) {
    console.error("Missing needle.png. Run: npm run smoke:capture");
    process.exit(1);
  }

  const opts = { confidence: 0.7 };
  const multiOpts = {
    ...opts,
    multiScale: true,
    scaleMin: 0.8,
    scaleMax: 1.2,
    scaleStep: 0.05,
  };
  const needleBytes = fs.readFileSync(needlePath);
  const { width, height } = screen.size();

  console.log("NCC benchmark");
  console.log(`screen: ${width}x${height}`);
  console.log(`warmup=${WARMUP}  runs=${RUNS}\n`);

  const scenarios = [
    {
      label: "find path (single scale, capture + disk needle)",
      fn: () => screen.find(needlePath, opts),
    },
    {
      label: "find path (multi-scale, capture + disk needle)",
      fn: () => screen.find(needlePath, multiOpts),
    },
    {
      label: "find buffer (single scale, capture + memory needle)",
      fn: () => screen.find(needleBytes, opts),
    },
    {
      label: "find buffer (multi-scale, capture + memory needle)",
      fn: () => screen.find(needleBytes, multiOpts),
    },
  ] as const;

  const results: { label: string; stats: Stats }[] = [];
  for (const s of scenarios) {
    results.push({ label: s.label, stats: await benchScenario(s.label, s.fn, WARMUP, RUNS) });
  }

  console.log("Summary (median ms):");
  for (const r of results) {
    console.log(`  ${r.stats.median.toFixed(1).padStart(7)}  ${r.label}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
