import { accessibility, windowApi } from "@spotter/core";
import { info, runSmokeScript } from "../lib/log";

/**
 * Generic UIA smoke: attach to Notepad or Calculator and dump tree health.
 * Requires Notepad or Calculator to be open.
 */
export async function run(): Promise<void> {
  accessibility.enable({ attachDelayMs: 300 });

  const windows = windowApi.list();
  const target =
    windows.find((w) => /记事本|Notepad/i.test(w.title)) ??
    windows.find((w) => /计算器|Calculator/i.test(w.title));

  if (!target) {
    throw new Error(
      "Open Notepad (记事本) or Calculator (计算器) before running this smoke"
    );
  }

  info(`target window: "${target.title}" id=${target.id}`);
  windowApi.focus(target.id);
  await sleep(400);

  const report = accessibility.attachWindowReport(target.id, 8);
  const root = report.elementId;
  const health = accessibility.treeHealth(root, 8);
  info(
    `attach: strategy=${report.attachStrategy} treeView=${report.treeView} nodes=${health.totalNodes}`
  );
  info(
    `tree: nodes=${health.totalNodes} buttons=${health.buttonCount} edits=${health.editCount}`
  );

  if (health.totalNodes < 2) {
    throw new Error("UIA tree too small — enable accessibility or check app version");
  }

  const dump = accessibility.dumpTree(root, 4);
  info(`dump preview (first 500 chars): ${dump.slice(0, 500)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("06-accessibility") ?? false;

if (isDirect) {
  void runSmokeScript("06-accessibility-notepad", run);
}
