/**
 * Window match → screen tap → mouse alignment (multi-monitor safe).
 *
 *   npm run smoke:match-tap
 *
 * Paints a synthetic patch into the foreground window capture, matches in-memory,
 * moves the mouse to matchTapScreen, and asserts getPosition is within tolerance.
 */
import * as path from "path";
import {
  loadNative,
  matchTapScreen,
  mouse,
  screen,
  toMatchBox,
  windowApi,
} from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { cropRgba, writeRgbaPng } from "../lib/png";

const PATCH_LEFT = 80;
const PATCH_TOP = 80;
const PATCH_W = 32;
const PATCH_H = 32;
const CONFIDENCE = 0.85;
const DEFAULT_TOL = 3;

function tol(): number {
  const n = Number(process.env.SPOTTERJS_MOUSE_TOL ?? String(DEFAULT_TOL));
  return Number.isFinite(n) ? n : DEFAULT_TOL;
}

function paintPatch(
  data: Buffer,
  imgW: number,
  imgH: number,
  left: number,
  top: number,
  width: number,
  height: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = left + x;
      const py = top + y;
      if (px < 0 || py < 0 || px >= imgW || py >= imgH) continue;
      const i = (py * imgW + px) * 4;
      data[i] = (x * 7 + y * 11) % 256;
      data[i + 1] = (x * 13 + y * 5) % 256;
      data[i + 2] = (x * 3 + y * 17) % 256;
      data[i + 3] = 255;
    }
  }
}

function syncFrame(win: { id: string; title: string; region: { left: number; top: number; width: number; height: number } }) {
  const native = loadNative();
  const frame = native.getWindowRegion(win.id);
  const cap = native.captureWindow(win.id);
  return {
    id: win.id,
    title: win.title,
    region: {
      left: frame.left,
      top: frame.top,
      width: cap.width,
      height: cap.height,
    },
  };
}

export async function run(): Promise<void> {
  const active = windowApi.getActive();
  const frame = syncFrame(active);
  const { width: w, height: h, left: fx, top: fy } = frame.region;

  if (w < PATCH_LEFT + PATCH_W + 10 || h < PATCH_TOP + PATCH_H + 10) {
    throw new Error(
      `foreground "${active.title}" too small (${w}x${h}) for patch at (${PATCH_LEFT},${PATCH_TOP})`
    );
  }

  const primary = screen.size();
  info(`foreground "${active.title}" frame left=${fx} top=${fy} ${w}x${h}`);
  info(`primary screen ${primary.width}x${primary.height}`);
  if (fx >= primary.width) {
    info("window on secondary monitor (frame.left >= primary width)");
  }

  const cap = windowApi.capture(active.id);
  const hayData = Buffer.from(cap.data);
  paintPatch(hayData, cap.width, cap.height, PATCH_LEFT, PATCH_TOP, PATCH_W, PATCH_H);

  const needleData = cropRgba(
    hayData,
    cap.width,
    cap.height,
    PATCH_LEFT,
    PATCH_TOP,
    PATCH_W,
    PATCH_H
  );

  const outDir = ensureOutputDir();
  writeRgbaPng(
    path.join(outDir, "match-tap-haystack.png"),
    cap.width,
    cap.height,
    hayData
  );
  writeRgbaPng(
    path.join(outDir, "match-tap-needle.png"),
    PATCH_W,
    PATCH_H,
    needleData
  );

  const native = loadNative();
  const localMatch = native.findTemplateBuffers(
    { data: hayData, width: cap.width, height: cap.height },
    { data: needleData, width: PATCH_W, height: PATCH_H },
    {
      confidence: CONFIDENCE,
      searchRegion: {
        left: PATCH_LEFT - 4,
        top: PATCH_TOP - 4,
        width: PATCH_W + 8,
        height: PATCH_H + 8,
      },
    }
  );
  const local = localMatch.region;
  if (!Number.isFinite(localMatch.score)) {
    throw new Error(`findTemplateBuffers returned invalid score: ${localMatch.score}`);
  }

  info(`matched window-local (${local.left},${local.top}) ${local.width}x${local.height} score=${localMatch.score.toFixed(4)}`);

  const screenRegion = {
    left: fx + local.left,
    top: fy + local.top,
    width: local.width,
    height: local.height,
  };
  const box = toMatchBox(frame.region, screenRegion);
  const target = matchTapScreen(box);
  info(`tap target screen (${target.x},${target.y})`);

  mouse.move(target.x, target.y);
  const pos = mouse.getPosition();
  const dx = Math.abs(pos.x - target.x);
  const dy = Math.abs(pos.y - target.y);
  info(`mouse at (${pos.x},${pos.y}) delta (${dx},${dy}) tol=${tol()}`);

  if (dx > tol() || dy > tol()) {
    throw new Error(
      `mouse misaligned: target (${target.x},${target.y}) actual (${pos.x},${pos.y}) delta (${dx},${dy}) > ${tol()}`
    );
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("08-match-tap-coords") ?? false;

if (isDirect) {
  void runSmokeScript("08-match-tap-coords", run);
}
