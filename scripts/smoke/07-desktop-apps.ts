/**
 * Smoke: desktop app discovery (process metadata on windows).
 */
import { desktop, windows } from "@spotterjs/core";
import { info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const allWindows = windows.list();
  info(`windows: ${allWindows.length}`);
  if (allWindows.length > 0) {
    const w = allWindows[0];
    info(
      `sample: title=${w.title} pid=${w.processId} process=${w.processName}`
    );
  }

  const apps = desktop.listApps();
  info(`apps: ${apps.length}`);
  const fg = desktop.getForegroundApp();
  info(
    `foreground: ${fg.processName} (pid=${fg.processId}) windows=${fg.windows.length}`
  );
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("07-desktop-apps") ?? false;

if (isDirect) {
  void runSmokeScript("07-desktop-apps", run);
}
