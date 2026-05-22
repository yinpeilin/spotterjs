/**
 * Synthetic PNG fixtures + in-memory NCC scenarios (no WeChat / live UI).
 *
 *   npm run smoke:ncc:synthetic
 *
 * Keep scenario names aligned with:
 *   crates/spotterjs-plugin-match-ncc/tests/common/fixtures.rs
 */
import * as fs from "fs";
import * as path from "path";
import { loadNative } from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { drawRectOutline, writeRgbaPng } from "../lib/png";

const ROOT = path.resolve(__dirname, "../..");
const FIXTURES = path.join(ROOT, "assets/ncc-fixtures");
const OUT = path.join(ensureOutputDir(), "ncc-synthetic");

const CONFIDENCE = 0.85;
const TOL = 2;

/** Must match `fixtures::build_find_scenarios().len()` in Rust. */
const FIND_SCENARIO_COUNT = 16;

type Region = { left: number; top: number; width: number; height: number };
type Capture = { data: Buffer; width: number; height: number };

type Scenario = {
  name: string;
  hay: Capture;
  needle: Capture;
  expected: { left: number; top: number };
  tol: number;
  opts?: Record<string, unknown>;
};

function solid(w: number, h: number, rgb: [number, number, number]): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = rgb[0];
    data[o + 1] = rgb[1];
    data[o + 2] = rgb[2];
    data[o + 3] = 255;
  }
  return data;
}

function gradient(w: number, h: number): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = Math.floor((x * 255) / Math.max(1, w - 1));
      data[o + 1] = Math.floor((y * 255) / Math.max(1, h - 1));
      data[o + 2] = Math.floor(((x + y) * 128) / Math.max(1, w + h - 1));
      data[o + 3] = 255;
    }
  }
  return data;
}

function noiseBg(w: number, h: number, seed: number): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const v = (x * 17 + y * 31 + seed) % 256;
      data[o] = v;
      data[o + 1] = 255 - v;
      data[o + 2] = (v * 3) % 256;
      data[o + 3] = 255;
    }
  }
  return data;
}

function paintRect(
  data: Buffer,
  imgW: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number]
): void {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = ((y + row) * imgW + (x + col)) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
}

function paintIcon(data: Buffer, imgW: number, x: number, y: number, size: number): void {
  const palette: [number, number, number][] = [
    [220, 60, 40],
    [40, 180, 220],
    [80, 200, 60],
    [200, 180, 50],
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = ((y + row) * imgW + (x + col)) * 4;
      const c = palette[(row + col) % 4];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
}

function paintStripes(data: Buffer, imgW: number, x: number, y: number, w: number, h: number): void {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = ((y + row) * imgW + (x + col)) * 4;
      const v = row % 3 === 0 ? 230 : 90;
      data[i] = v;
      data[i + 1] = Math.floor(v / 2);
      data[i + 2] = 255 - v;
    }
  }
}

function crop(hay: Buffer, imgW: number, x: number, y: number, w: number, h: number): Buffer {
  const out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const si = ((y + row) * imgW + (x + col)) * 4;
      const oi = (row * w + col) * 4;
      hay.copy(out, oi, si, si + 4);
    }
  }
  return out;
}

function cap(data: Buffer, width: number, height: number): Capture {
  return { data, width, height };
}

function buildScenarios(): Scenario[] {
  const s: Scenario[] = [];

  {
    const w = 64;
    const h = 64;
    const data = solid(w, h, [40, 40, 40]);
    paintRect(data, w, 10, 15, 8, 8, [240, 20, 20]);
    s.push({
      name: "solid_patch_64",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 10, 15, 8, 8), 8, 8),
      expected: { left: 10, top: 15 },
      tol: 0,
    });
  }

  {
    const w = 400;
    const h = 300;
    const data = gradient(w, h);
    paintIcon(data, w, 120, 80, 32);
    s.push({
      name: "gradient_icon_400x300",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 120, 80, 32, 32), 32, 32),
      expected: { left: 120, top: 80 },
      tol: TOL,
    });
  }

  {
    const w = 320;
    const h = 240;
    const data = gradient(w, h);
    paintIcon(data, w, 200, 160, 8);
    s.push({
      name: "tiny_icon_8x8",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 200, 160, 8, 8), 8, 8),
      expected: { left: 200, top: 160 },
      tol: 0,
    });
  }

  {
    const w = 200;
    const h = 160;
    const data = solid(w, h, [25, 25, 30]);
    paintStripes(data, w, 40, 60, 48, 20);
    s.push({
      name: "stripe_pattern",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 40, 60, 48, 20), 48, 20),
      expected: { left: 40, top: 60 },
      tol: 0,
    });
  }

  {
    const w = 480;
    const h = 120;
    const data = solid(w, h, [28, 28, 32]);
    paintRect(data, w, 180, 48, 56, 14, [0, 180, 255]);
    s.push({
      name: "wide_toolbar_chip",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 180, 48, 56, 14), 56, 14),
      expected: { left: 180, top: 48 },
      tol: TOL,
    });
  }

  {
    const w = 160;
    const h = 400;
    const data = solid(w, h, [32, 32, 36]);
    paintRect(data, w, 24, 200, 14, 40, [255, 200, 0]);
    s.push({
      name: "tall_sidebar_chip",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 24, 200, 14, 40), 14, 40),
      expected: { left: 24, top: 200 },
      tol: TOL,
    });
  }

  {
    const w = 360;
    const h = 280;
    const data = noiseBg(w, h, 42);
    paintRect(data, w, 88, 66, 20, 20, [255, 40, 40]);
    s.push({
      name: "noise_background",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 88, 66, 20, 20), 20, 20),
      expected: { left: 88, top: 66 },
      tol: TOL,
    });
  }

  {
    const w = 240;
    const h = 180;
    const data = solid(w, h, [50, 50, 50]);
    paintRect(data, w, 100, 70, 24, 24, [58, 58, 58]);
    s.push({
      name: "low_contrast_patch",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 100, 70, 24, 24), 24, 24),
      expected: { left: 100, top: 70 },
      tol: TOL,
    });
  }

  {
    const w = 200;
    const h = 200;
    const data = solid(w, h, [30, 30, 30]);
    paintIcon(data, w, 15, 20, 12);
    paintRect(data, w, 55, 20, 12, 12, [200, 50, 50]);
    s.push({
      name: "search_region_top_left",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 15, 20, 12, 12), 12, 12),
      expected: { left: 15, top: 20 },
      tol: 0,
      opts: { searchRegion: { left: 0, top: 0, width: 50, height: 80 } },
    });
  }

  {
    const w = 800;
    const h = 600;
    const data = solid(w, h, [35, 35, 35]);
    paintRect(data, w, 500, 400, 24, 24, [255, 120, 0]);
    s.push({
      name: "medium_800x600",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 500, 400, 24, 24), 24, 24),
      expected: { left: 500, top: 400 },
      tol: TOL,
    });
  }

  {
    const w = 2000;
    const h = 1100;
    const data = solid(w, h, [40, 40, 40]);
    paintRect(data, w, 1200, 700, 24, 24, [240, 30, 30]);
    s.push({
      name: "large_pyramid_center",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 1200, 700, 24, 24), 24, 24),
      expected: { left: 1200, top: 700 },
      tol: 4,
    });
  }

  {
    const w = 2000;
    const h = 1100;
    const data = solid(w, h, [40, 40, 40]);
    paintIcon(data, w, 28, 32, 28);
    s.push({
      name: "large_pyramid_topleft",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 28, 32, 28, 28), 28, 28),
      expected: { left: 28, top: 32 },
      tol: 4,
    });
  }

  {
    const w = 2000;
    const h = 1100;
    const data = solid(w, h, [40, 40, 40]);
    paintIcon(data, w, 1850, 980, 28);
    s.push({
      name: "large_pyramid_bottomright",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 1850, 980, 28, 28), 28, 28),
      expected: { left: 1850, top: 980 },
      tol: 4,
    });
  }

  {
    const w = 300;
    const h = 200;
    const data = solid(w, h, [50, 50, 50]);
    paintRect(data, w, 20, 30, 20, 20, [200, 0, 0]);
    paintIcon(data, w, 200, 120, 20);
    s.push({
      name: "decoy_different_pattern",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 20, 30, 20, 20), 20, 20),
      expected: { left: 20, top: 30 },
      tol: 0,
    });
  }

  {
    const w = 120;
    const h = 120;
    const data = solid(w, h, [30, 30, 30]);
    paintRect(data, w, 30, 30, 18, 18, [180, 50, 50]);
    s.push({
      name: "multiscale_1p5x",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 30, 30, 12, 12), 12, 12),
      expected: { left: 30, top: 30 },
      tol: 3,
      opts: { multiScale: true, scaleMin: 1.0, scaleMax: 1.6, scaleStep: 0.05 },
    });
  }

  {
    const w = 140;
    const h = 140;
    const data = solid(w, h, [25, 25, 25]);
    paintRect(data, w, 50, 50, 10, 10, [180, 60, 60]);
    s.push({
      name: "multiscale_0p8x",
      hay: cap(data, w, h),
      needle: cap(crop(data, w, 50, 50, 12, 12), 12, 12),
      expected: { left: 50, top: 50 },
      tol: 3,
      opts: { multiScale: true, scaleMin: 0.75, scaleMax: 1.0, scaleStep: 0.05 },
    });
  }

  if (s.length !== FIND_SCENARIO_COUNT) {
    throw new Error(
      `TS scenario count ${s.length} != Rust FIND_SCENARIO_COUNT ${FIND_SCENARIO_COUNT}`
    );
  }
  return s;
}

function assertNear(
  name: string,
  found: Region,
  expected: { left: number; top: number },
  tol: number
): void {
  const dx = Math.abs(found.left - expected.left);
  const dy = Math.abs(found.top - expected.top);
  if (dx > tol || dy > tol) {
    throw new Error(
      `${name}: expected (${expected.left},${expected.top}), got (${found.left},${found.top}), tol=${tol}`
    );
  }
}

function writeFixtures(scenarios: Scenario[]): void {
  fs.mkdirSync(FIXTURES, { recursive: true });
  for (const sc of scenarios) {
    const dir = path.join(FIXTURES, sc.name);
    fs.mkdirSync(dir, { recursive: true });
    writeRgbaPng(path.join(dir, "haystack.png"), sc.hay.width, sc.hay.height, sc.hay.data);
    writeRgbaPng(path.join(dir, "needle.png"), sc.needle.width, sc.needle.height, sc.needle.data);
  }
  info(`wrote ${scenarios.length} fixture sets → ${FIXTURES}`);
}

function writeDebugOverlay(sc: Scenario, found: Region): void {
  const out = Buffer.from(sc.hay.data);
  drawRectOutline(out, sc.hay.width, sc.hay.height, found, [0, 255, 0], 2);
  writeRgbaPng(path.join(OUT, `${sc.name}-match.png`), sc.hay.width, sc.hay.height, out);
}

export async function run(): Promise<void> {
  const native = loadNative();
  const scenarios = buildScenarios();
  writeFixtures(scenarios);
  fs.mkdirSync(OUT, { recursive: true });

  let passed = 0;
  for (const sc of scenarios) {
    const found = native.findTemplateBuffers(sc.hay, sc.needle, {
      confidence: CONFIDENCE,
      ...(sc.opts ?? {}),
    });
    assertNear(sc.name, found, sc.expected, sc.tol);
    writeDebugOverlay(sc, found);
    info(`✓ ${sc.name} → (${found.left},${found.top})`);
    passed++;
  }

  const disk = scenarios[0];
  const foundDisk = native.findTemplateBuffers(
    native.loadImageFromPath(path.join(FIXTURES, disk.name, "haystack.png")),
    native.loadImageFromPath(path.join(FIXTURES, disk.name, "needle.png")),
    { confidence: CONFIDENCE }
  );
  assertNear(`${disk.name}_png_disk`, foundDisk, disk.expected, disk.tol);
  info(`✓ ${disk.name}_png_disk (loadImageFromPath)`);
  passed++;

  info(`ncc synthetic: ${passed}/${passed} scenarios passed`);
}

if (process.argv[1]?.includes("ncc-synthetic-scenarios")) {
  void runSmokeScript("ncc-synthetic-scenarios", run);
}
