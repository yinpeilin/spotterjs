/**
 * Smoke: desktop app discovery (process metadata on windows).
 */
import { desktop, windowApi } from "@spotter/core";

function main() {
  const windows = windowApi.list();
  console.log(`windows: ${windows.length}`);
  if (windows.length > 0) {
    const w = windows[0];
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
