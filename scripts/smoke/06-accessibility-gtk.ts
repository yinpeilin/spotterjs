/**
 * Linux Phase2 smoke (AT-SPI). Run on Linux with accessibility-linux feature built.
 * Requires gedit or GNOME Calculator open.
 *
 *   SPOTTER_ACCESSIBILITY=1 tsx scripts/smoke/06-accessibility-gtk.ts
 */
import { accessibility, windowApi } from "@spotter/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  if (process.platform !== "linux") {
    info("skip: 06-accessibility-gtk is for Linux only");
    return;
  }

  accessibility.enable({ attachDelayMs: 500 });

  const windows = windowApi.list();
  const target =
    windows.find((w) => /gedit|文本编辑器/i.test(w.title)) ??
    windows.find((w) => /Calculator|计算器/i.test(w.title));

  if (!target) {
    throw new Error("Open gedit or Calculator before running this smoke");
  }

  info(`target: "${target.title}"`);
  windowApi.focus(target.id);
  await sleep(500);

  const root = accessibility.attachWindow(target.id);
  const health = accessibility.treeHealth(root, 8);
  info(`nodes=${health.totalNodes}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("06-accessibility-gtk") ?? false;

if (isDirect) {
  void runSmokeScript("06-accessibility-gtk", run);
}
