import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import {
  desktop,
  mouse,
  windows,
  type MatchOptions,
  type MatchResult,
  type WindowInfo,
} from "@spotterjs/core";
import { writeRgbaPng } from "../../../scripts/lib/png";

export const ROOT = path.resolve(process.cwd());
export const TEMPLATE_PATH = path.join(
  ROOT,
  "examples",
  "paint",
  "assets",
  "tool-template.png"
);
const TOOLBAR_SEARCH_REGION = {
  left: 300,
  top: 80,
  width: 180,
  height: 150,
};
export const MATCH_OPTIONS: MatchOptions = {
  confidence: Number(process.env.SPOTTERJS_PAINT_CONFIDENCE ?? "0.85"),
  region: TOOLBAR_SEARCH_REGION,
  scale:
    process.env.SPOTTERJS_PAINT_MULTISCALE === "1"
      ? { min: 0.8, max: 1.25, step: 0.05 }
      : undefined,
};

const PAINT_PROCESS_HINTS = ["mspaint", "paintstudio", "paint"];

export function info(message: string): void {
  console.log(`  ${message}`);
}

export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(4) : "n/a";
}

export function ensureExamplesOutputDir(): string {
  const dir = path.join(ROOT, "test-output", "examples");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function paintOutputPath(fileName: string): string {
  return path.join(ensureExamplesOutputDir(), fileName);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueWindows(windows: WindowInfo[]): WindowInfo[] {
  const seen = new Set<string>();
  const out: WindowInfo[] = [];
  for (const win of windows) {
    if (seen.has(win.id)) continue;
    seen.add(win.id);
    out.push(win);
  }
  return out;
}

function isPaintWindow(win: WindowInfo): boolean {
  const processName = win.processName.toLowerCase();
  const exePath = win.exePath?.toLowerCase() ?? "";
  return PAINT_PROCESS_HINTS.some(
    (hint) => processName.includes(hint) || exePath.includes(hint)
  );
}

export function findPaintWindow(): WindowInfo | undefined {
  const appWindows = desktop
    .findApps("paint")
    .flatMap((app) => app.windows)
    .filter(isPaintWindow);
  const mspaintWindows = desktop.findApps("mspaint").flatMap((app) => app.windows);

  return uniqueWindows([...appWindows, ...mspaintWindows]).find(
    (win) => win.id && win.region.width > 0 && win.region.height > 0
  );
}

export async function waitForPaintWindow(timeoutMs = 10_000): Promise<WindowInfo> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const win = findPaintWindow();
    if (win) return win;
    await sleep(250);
  }

  throw new Error(
    "Paint window not found. Open Paint manually or ensure mspaint.exe can start."
  );
}

export function launchPaint(): void {
  if (process.platform !== "win32") {
    throw new Error("Paint examples require Windows and mspaint.exe.");
  }

  spawn("cmd", ["/c", "start", "", "mspaint.exe"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
}

export async function ensurePaintWindow(): Promise<WindowInfo> {
  let win = findPaintWindow();
  if (!win) {
    info("starting mspaint.exe");
    launchPaint();
    win = await waitForPaintWindow();
  }

  return focusPaintWindow(win);
}

export async function focusPaintWindow(win: WindowInfo): Promise<WindowInfo> {
  if (win.isMinimized) {
    windows.restore(win.id);
    await sleep(350);
  }

  windows.move(win.id, 40, 40);
  await sleep(150);
  windows.focus(win.id);
  await sleep(500);

  const current = findPaintWindow() ?? win;
  info(
    `paint window "${current.title}" id=${current.id} ${current.region.width}x${current.region.height}`
  );
  return current;
}

export function capturePaintWindow(win: WindowInfo, fileName: string): string {
  const cap = windows.capture(win.id);
  const outPath = paintOutputPath(fileName);
  writeRgbaPng(outPath, cap.width, cap.height, Buffer.from(cap.data));
  info(`wrote ${outPath}`);
  return outPath;
}

export function matchPaintTool(win: WindowInfo): MatchResult {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`missing Paint tool template: ${TEMPLATE_PATH}`);
  }

  try {
    return windows.findTemplate(win.id, TEMPLATE_PATH, MATCH_OPTIONS);
  } catch (err) {
    capturePaintWindow(win, "paint-match-failed.png");
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Paint tool template was not found. Ensure the Paint toolbar is visible and matches examples/paint/assets/tool-template.png. Native error: ${message}`
    );
  }
}

export function tapPaintTool(win: WindowInfo): MatchResult {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`missing Paint tool template: ${TEMPLATE_PATH}`);
  }

  return windows.tapTemplate(win.id, TEMPLATE_PATH, MATCH_OPTIONS);
}

export function moveMouseToWindowCenter(win: WindowInfo): { x: number; y: number } {
  const x = win.region.left + Math.floor(win.region.width / 2);
  const y = win.region.top + Math.floor(win.region.height / 2);
  mouse.move(x, y);
  return { x, y };
}
