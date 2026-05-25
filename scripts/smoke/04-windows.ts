import { windows } from "@spotterjs/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const allWindows = windows.list();
  info(`listed ${allWindows.length} window(s)`);

  const active = windows.active();
  if (!active.id || active.id.trim().length === 0) {
    throw new Error("getActiveWindow() returned empty id");
  }
  info(`active: "${active.title}" (id=${active.id})`);

  if (allWindows.length === 0) {
    info("warning: window list empty (active window still valid)");
  } else {
    const sample = allWindows.slice(0, 3);
    for (const w of sample) {
      info(`  - "${w.title}" ${w.region.width}x${w.region.height}`);
    }
    if (allWindows.length > 3) {
      info(`  ... and ${allWindows.length - 3} more`);
    }
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("04-windows") ?? false;

if (isDirect) {
  void runSmokeScript("04-windows", run);
}
