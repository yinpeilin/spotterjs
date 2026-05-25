/**
 * Smoke: desktop app discovery (process metadata on windows).
 */
import { desktop, windows } from "@spotterjs/core";

function main() {
  const allWindows = windows.list();
  console.log(`windows: ${allWindows.length}`);
  if (allWindows.length > 0) {
    const w = allWindows[0];
    console.log(
      `sample: title=${w.title} pid=${w.processId} process=${w.processName}`
    );
  }

  const apps = desktop.listApps();
  console.log(`apps: ${apps.length}`);
  const fg = desktop.getForegroundApp();
  console.log(
    `foreground: ${fg.processName} (pid=${fg.processId}) windows=${fg.windows.length}`
  );
}

main();
