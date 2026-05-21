import type { DesktopApp, WindowInfo } from "@spotter/base";
import { loadNative, type NativeDesktopApp, type NativeWindow } from "./native";

function mapWindow(w: NativeWindow): WindowInfo {
  return {
    id: w.id,
    idHex: w.idHex,
    title: w.title,
    region: w.region,
    processId: w.processId,
    processName: w.processName,
    exePath: w.exePath,
    isMinimized: w.isMinimized,
    isForeground: w.isForeground,
  };
}

function mapApp(a: NativeDesktopApp): DesktopApp {
  return {
    processId: a.processId,
    processName: a.processName,
    exePath: a.exePath,
    windows: a.windows.map(mapWindow),
    isForeground: a.isForeground,
  };
}

export const desktop = {
  listApps(): DesktopApp[] {
    return loadNative().listDesktopApps().map(mapApp);
  },

  findApps(substring: string): DesktopApp[] {
    return loadNative().findDesktopApps(substring).map(mapApp);
  },

  findWindows(substring: string): WindowInfo[] {
    return loadNative().findWindowsByTitle(substring).map(mapWindow);
  },

  waitForWindow(
    substring: string,
    timeoutMs: number,
    pollMs?: number
  ): WindowInfo {
    return mapWindow(
      loadNative().waitForWindowByTitle(substring, timeoutMs, pollMs)
    );
  },

  getForegroundApp(): DesktopApp {
    return mapApp(loadNative().getForegroundApp());
  },
};
