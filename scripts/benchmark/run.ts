import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import sharp from "sharp";
import { image, screen, windows } from "@spotterjs/core";
import { loadNative } from "@spotterjs/core/unstable-native";
import { createOcr, defaultModelDir } from "@spotterjs/plugin-ocr";
import { cropImage, loadImage, resizeRgba } from "../../packages/plugin-ocr/src/image";
import { boxesFromBitmap, decodeCtc } from "../../packages/plugin-ocr/src/postprocess";
import { optimizeCapture, workspaceImageStore } from "../../packages/mcp/src/adapters/artifacts";
import { writeRgbaPng } from "../lib/png";

type Suite = "synthetic" | "deep" | "ocr" | "all";
type OcrBenchmarkProfile = "mobile" | "server" | "large";
type OcrBenchmarkProvider = "cpu" | "dml" | "cuda";
type Capture = { data: Buffer; width: number; height: number };

type Stats = {
  min: number;
  median: number;
  p95: number;
  mean: number;
  stddev: number;
  samples: number[];
};

type BenchmarkResult = {
  suite: "synthetic" | "deep" | "ocr";
  name: string;
  stats: Stats;
  notes?: string[];
};

type Options = {
  suite: Suite;
  runs: number;
  warmup: number;
  json?: string;
  markdown?: string;
  filter?: string;
  modelDir?: string;
  ocrProfiles: OcrBenchmarkProfile[];
  ocrProviders: OcrBenchmarkProvider[];
  ocrPreprocess: boolean;
};

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "test-output", "benchmark");
const FIXTURES = path.join(OUT, "fixtures");
const CONFIDENCE = 0.85;

function parseArgs(argv: string[]): Options {
  const options: Options = {
    suite: "synthetic",
    runs: 15,
    warmup: 3,
    ocrProfiles: ["mobile", "server", "large"],
    ocrProviders: ["cpu", "dml", "cuda"],
    ocrPreprocess: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[++i];
    };
    if (arg === "--suite") {
      const value = next();
      if (value !== "synthetic" && value !== "deep" && value !== "ocr" && value !== "all") {
        throw new Error(`invalid --suite: ${value}`);
      }
      options.suite = value;
    } else if (arg === "--runs") {
      options.runs = positiveInt(next(), arg);
    } else if (arg === "--warmup") {
      options.warmup = positiveInt(next(), arg, true);
    } else if (arg === "--json") {
      options.json = next();
    } else if (arg === "--markdown") {
      options.markdown = next();
    } else if (arg === "--filter") {
      options.filter = next();
    } else if (arg === "--model-dir") {
      options.modelDir = next();
    } else if (arg === "--ocr-profiles") {
      options.ocrProfiles = parseCsv(next(), ["mobile", "server", "large"], arg);
    } else if (arg === "--ocr-providers") {
      options.ocrProviders = parseCsv(next(), ["cpu", "dml", "cuda"], arg);
    } else if (arg === "--ocr-preprocess") {
      options.ocrPreprocess = truthy(next());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function positiveInt(value: string, label: string, allowZero = false): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} integer`);
  }
  return n;
}

function printHelp(): void {
  console.log(`Usage: npm run benchmark:ci -- [options]

Options:
  --suite synthetic|deep|ocr|all  Benchmark suite to run
  --runs N                   Measured iterations per benchmark
  --warmup N                 Warmup iterations per benchmark
  --json PATH                Write machine-readable results
  --markdown PATH            Write Markdown summary
  --filter TEXT              Run benchmark names containing TEXT
  --model-dir PATH           OCR model directory for deep OCR benchmarks
  --ocr-profiles LIST        OCR profiles to compare (mobile,server,large)
  --ocr-providers LIST       OCR providers to compare (cpu,dml,cuda)
  --ocr-preprocess BOOL      Enable OCR preprocessing in benchmark
`);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCsv<T extends string>(value: string, allowed: readonly T[], label: string): T[] {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const item of values) {
    if (!allowed.includes(item as T)) {
      throw new Error(`${label} contains unsupported value: ${item}`);
    }
  }
  return values as T[];
}

function truthy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

async function bench(
  suite: BenchmarkResult["suite"],
  name: string,
  fn: () => unknown | Promise<unknown>,
  options: Options,
  notes?: string[]
): Promise<BenchmarkResult | undefined> {
  if (options.filter && !name.toLowerCase().includes(options.filter.toLowerCase())) {
    return undefined;
  }
  for (let i = 0; i < options.warmup; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < options.runs; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const stats = summarize(samples);
  console.log(`${suite}/${name}`);
  console.log(`  ${formatStats(stats)}`);
  return { suite, name, stats, notes };
}

function summarize(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  const variance =
    samples.reduce((sum, n) => sum + (n - mean) ** 2, 0) / Math.max(1, samples.length - 1);
  return {
    min: sorted[0],
    median: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    mean,
    stddev: Math.sqrt(variance),
    samples: sorted,
  };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function formatStats(stats: Stats): string {
  return [
    `mean=${stats.mean.toFixed(2)} ms`,
    `median=${stats.median.toFixed(2)} ms`,
    `p95=${stats.p95.toFixed(2)} ms`,
    `min=${stats.min.toFixed(2)} ms`,
    `stddev=${stats.stddev.toFixed(2)} ms`,
  ].join("  ");
}

function solid(width: number, height: number, rgb: [number, number, number]): Capture {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  }
  return { data, width, height };
}

function gradient(width: number, height: number): Capture {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = Math.floor((x * 255) / Math.max(1, width - 1));
      data[o + 1] = Math.floor((y * 255) / Math.max(1, height - 1));
      data[o + 2] = Math.floor(((x + y) * 128) / Math.max(1, width + height - 1));
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

async function textFixture(
  text: string,
  width: number,
  height: number,
  background = [255, 255, 255]
): Promise<Buffer> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="rgb(${background[0]},${background[1]},${background[2]})"/>
  <text x="48" y="${Math.floor(height * 0.64)}" font-family="Segoe UI, Microsoft YaHei, Arial, sans-serif" font-size="${Math.floor(height * 0.42)}" font-weight="700" fill="#111827" letter-spacing="0">${escapeXml(text)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function paintRect(
  image: Capture,
  x: number,
  y: number,
  width: number,
  height: number,
  rgb: [number, number, number]
): void {
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = ((y + row) * image.width + (x + col)) * 4;
      image.data[i] = rgb[0];
      image.data[i + 1] = rgb[1];
      image.data[i + 2] = rgb[2];
    }
  }
}

function crop(source: Capture, left: number, top: number, width: number, height: number): Capture {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcStart = ((top + y) * source.width + left) * 4;
    const dstStart = y * width * 4;
    source.data.copy(data, dstStart, srcStart, srcStart + width * 4);
  }
  return { data, width, height };
}

function syntheticMatchFixture(): { hay: Capture; needle: Capture; needlePath: string } {
  const hay = gradient(800, 600);
  paintRect(hay, 500, 400, 24, 24, [255, 120, 0]);
  const needle = crop(hay, 500, 400, 24, 24);
  fs.mkdirSync(FIXTURES, { recursive: true });
  const needlePath = path.join(FIXTURES, "needle.png");
  writeRgbaPng(needlePath, needle.width, needle.height, needle.data);
  return { hay, needle, needlePath };
}

function buildBitmap(width: number, height: number): Float32Array {
  const bitmap = new Float32Array(width * height);
  for (let block = 0; block < 80; block++) {
    const x0 = (block * 37) % (width - 12);
    const y0 = (block * 23) % (height - 6);
    for (let y = y0; y < y0 + 5; y++) {
      for (let x = x0; x < x0 + 10; x++) {
        bitmap[y * width + x] = 0.95;
      }
    }
  }
  return bitmap;
}

async function syntheticBenchmarks(options: Options): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const native = loadNative();
  const fixture = syntheticMatchFixture();
  const needlePng = fs.readFileSync(fixture.needlePath);
  const decodedNeedle = image.decode(needlePng);
  const encodedHay = image.encode(fixture.hay);
  const bitmap = buildBitmap(480, 320);
  const logits = Array.from({ length: 64 }, (_, step) =>
    Array.from({ length: 96 }, (_, i) => (i === (step % 20) + 1 ? 0.95 : 0.01))
  );
  const ocr = await createOcr({
    engine: {
      async read() {
        return [
          {
            text: "Send message",
            score: 0.9,
            region: { left: 1, top: 2, width: 10, height: 4 },
            box: [
              { x: 1, y: 2 },
              { x: 11, y: 2 },
              { x: 11, y: 6 },
              { x: 1, y: 6 },
            ],
            center: { x: 6, y: 4 },
          },
        ];
      },
    },
  });

  await add(results, bench("synthetic", "core.image.decode png buffer", () => image.decode(encodedHay), options));
  await add(results, bench("synthetic", "core.image.findTemplate buffer needle", () =>
    image.findTemplate(fixture.hay, needlePng, { confidence: CONFIDENCE }), options));
  await add(results, bench("synthetic", "core.image.findTemplate decoded needle", () =>
    native.findTemplateBuffers(fixture.hay, decodedNeedle, { confidence: CONFIDENCE }), options));
  await add(results, bench("synthetic", "core.image.findAllTemplates decoded needle", () =>
    native.findAllTemplateBuffers(fixture.hay, decodedNeedle, { confidence: CONFIDENCE }), options));
  await add(results, bench("synthetic", "core.image.encode 800x600", () => image.encode(fixture.hay), options));
  await add(results, bench("synthetic", "ocr.cropImage 600x400", () =>
    cropImage(fixture.hay, { left: 100, top: 80, width: 600, height: 400 }), options));
  await add(results, bench("synthetic", "ocr.resizeRgba 960x960", () =>
    resizeRgba(fixture.hay, 960, 960), options));
  await add(results, bench("synthetic", "ocr.boxesFromBitmap 480x320", () =>
    boxesFromBitmap(bitmap, 480, 320, 0.3), options));
  await add(results, bench("synthetic", "ocr.decodeCtc 64x96", () =>
    decodeCtc(logits, Array.from({ length: 95 }, (_, i) => String.fromCharCode(33 + i))), options));
  await add(results, bench("synthetic", "ocr.findAllText cached fake engine", () =>
    ocr.findAllText(fixture.hay, "send", { caseSensitive: false }), options));
  await add(results, bench("synthetic", "mcp.optimizeCapture downscale", () =>
    optimizeCapture(solid(2400, 1350, [30, 40, 50]), 1600), options));

  return results;
}

async function deepBenchmarks(options: Options): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const outNeedle = path.join(FIXTURES, "deep-needle.png");
  fs.mkdirSync(FIXTURES, { recursive: true });

  let capture: Capture | undefined;
  await add(results, bench("deep", "screen.capture full", () => {
    capture = screen.capture();
    return capture;
  }, options));

  if (capture) {
    const width = Math.min(80, Math.max(8, Math.floor(capture.width / 8)));
    const height = Math.min(80, Math.max(8, Math.floor(capture.height / 8)));
    const left = Math.max(0, Math.floor(capture.width / 2) - Math.floor(width / 2));
    const top = Math.max(0, Math.floor(capture.height / 2) - Math.floor(height / 2));
    const needle = crop(capture, left, top, width, height);
    writeRgbaPng(outNeedle, needle.width, needle.height, needle.data);
    const needleBytes = fs.readFileSync(outNeedle);
    await add(results, bench("deep", "screen.findTemplate single-scale buffer", () =>
      screen.findTemplate(needleBytes, { confidence: 0.7 }), options));
    await add(results, bench("deep", "screen.findTemplate multi-scale buffer", () =>
      screen.findTemplate(needleBytes, { confidence: 0.7, scale: { min: 0.9, max: 1.1, step: 0.05 } }), options));
    await add(results, bench("deep", "mcp.workspaceImageStore.writeCapture", () =>
      workspaceImageStore.writeCapture(capture!, { prefix: "benchmark-deep" }), options));
  }

  try {
    const active = windows.getActive();
    await add(results, bench("deep", "windows.capture active", () =>
      screen.captureWindow(active.id), options));
    if (fs.existsSync(outNeedle)) {
      await add(results, bench("deep", "windows.findTemplate active", () =>
        windows.findTemplate(active.id, outNeedle, { confidence: 0.7 }), options));
    }
  } catch (error) {
    console.warn(`deep/windows skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const modelDir = options.modelDir ?? defaultModelDir();
    await add(results, bench("deep", "ocr.createOcr cold mobile", () =>
      createOcr({ modelDir, modelProfile: "mobile", cache: false }), options, [`modelDir=${modelDir}`]));
    for (const concurrency of [1, 2, 4]) {
      const client = await createOcr({ modelDir, modelProfile: "mobile", recognitionConcurrency: concurrency });
      const source = capture ?? solid(640, 360, [255, 255, 255]);
      await add(results, bench("deep", `ocr.read warm mobile concurrency=${concurrency}`, () =>
        client.read(source), options, [`modelDir=${modelDir}`]));
    }
  } catch (error) {
    console.warn(`deep/ocr skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  return results;
}

async function ocrBenchmarks(options: Options): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const modelDir = options.modelDir ?? defaultModelDir();
  const samples = [
    { name: "english-save", expected: "Save", image: await textFixture("Save", 640, 220) },
    { name: "english-settings", expected: "Settings", image: await textFixture("Settings", 760, 220) },
    { name: "mixed-order-id", expected: "Order", image: await textFixture("Order ID 2026", 820, 220) },
  ];

  for (const profile of options.ocrProfiles) {
    for (const provider of options.ocrProviders) {
      try {
        const client = await createOcr({
          modelDir,
          modelProfile: profile,
          executionProviders: provider === "cpu" ? ["cpu"] : [provider, "cpu"],
          preprocess: options.ocrPreprocess ? { grayscale: true, normalize: true, sharpen: true } : undefined,
          cache: false,
        });
        for (const sample of samples) {
          await add(results, bench("ocr", `${profile}.${provider}.${sample.name}`, async () => {
            const t0 = performance.now();
            const lines = await client.read(sample.image);
            const elapsed = performance.now() - t0;
            if (!lines.length) throw new Error("OCR returned no lines");
            if (!lines.some((line) => line.text.toLowerCase().includes(sample.expected.toLowerCase()))) {
              throw new Error(`missing expected text: ${sample.expected}`);
            }
            return elapsed;
          }, options, [`modelDir=${modelDir}`, `profile=${profile}`, `provider=${provider}`, `preprocess=${options.ocrPreprocess}`]));
        }
      } catch (error) {
        console.warn(`ocr/${profile}/${provider} skipped: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return results;
}

async function add(
  results: BenchmarkResult[],
  pending: Promise<BenchmarkResult | undefined>
): Promise<void> {
  const result = await pending;
  if (result) results.push(result);
}

function gitSha(): string | undefined {
  try {
    const head = fs.readFileSync(path.join(ROOT, ".git", "HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice(5);
      return fs.readFileSync(path.join(ROOT, ".git", ref), "utf8").trim();
    }
    return head;
  } catch {
    return undefined;
  }
}

function reportPayload(options: Options, results: BenchmarkResult[]) {
  return {
    generatedAt: new Date().toISOString(),
    options: {
      suite: options.suite,
      runs: options.runs,
      warmup: options.warmup,
      filter: options.filter,
      ocrProfiles: options.ocrProfiles,
      ocrProviders: options.ocrProviders,
      ocrPreprocess: options.ocrPreprocess,
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      cpus: os.cpus().length,
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      gitSha: gitSha(),
    },
    results,
  };
}

function writeJson(filePath: string, payload: unknown): void {
  const resolved = path.resolve(ROOT, filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(payload, null, 2));
}

function writeMarkdown(filePath: string, payload: ReturnType<typeof reportPayload>): void {
  const resolved = path.resolve(ROOT, filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const lines = [
    "# SpotterJS Benchmark Summary",
    "",
    `Generated: ${payload.generatedAt}`,
    `Suite: ${payload.options.suite}`,
    `Runs: ${payload.options.runs}`,
    `Warmup: ${payload.options.warmup}`,
    "",
    "| Suite | Benchmark | Median ms | P95 ms | Mean ms | Min ms | Stddev ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...payload.results.map((r) =>
      [
        r.suite,
        r.name,
        r.stats.median.toFixed(2),
        r.stats.p95.toFixed(2),
        r.stats.mean.toFixed(2),
        r.stats.min.toFixed(2),
        r.stats.stddev.toFixed(2),
      ].join(" | ")
    ).map((row) => `| ${row} |`),
    "",
  ];
  fs.writeFileSync(resolved, lines.join("\n"));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT, { recursive: true });
  const results: BenchmarkResult[] = [];

  if (options.suite === "synthetic" || options.suite === "all") {
    results.push(...await syntheticBenchmarks(options));
  }
  if (options.suite === "deep" || options.suite === "all") {
    results.push(...await deepBenchmarks(options));
  }
  if (options.suite === "ocr" || options.suite === "all") {
    results.push(...await ocrBenchmarks(options));
  }

  const payload = reportPayload(options, results);
  if (options.json) writeJson(options.json, payload);
  if (options.markdown) writeMarkdown(options.markdown, payload);

  console.log(`\n${results.length} benchmark(s) reported.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
