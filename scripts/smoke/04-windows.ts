import { windowApi } from "@spotterjs/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const windows = windowApi.list();
  info(`listed ${windows.length} window(s)`);

  const active = windowApi.getActive();
  if (!active.id || active.id.trim().length === 0) {
    throw new Error("getActiveWindow() returned empty id");
  }
  info(`active: "${active.title}" (id=${active.id})`);

  if (windows.length === 0) {
    info("warning: window list empty (active window still valid)");
  } else {
    const sample = windows.slice(0, 3);
    for (const w of sample) {
      info(`  - "${w.title}" ${w.region.width}x${w.region.height}`);
    }
    if (windows.length > 3) {
      info(`  ... and ${windows.length - 3} more`);
    }
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("04-windows") ?? false;

if (isDirect) {
  void runSmokeScript("04-windows", run);
}
