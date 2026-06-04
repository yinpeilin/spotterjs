import type { DesktopApp, WindowInfo } from "@spotterjs/base";
import { callNative } from "./errors";
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

/**
 * Desktop application and window discovery grouped by process.
 *
 * Use this for process-name discovery and title-based window waits. Window IDs
 * returned here can be passed to `windows` APIs.
 */
export const desktop = {
  /**
   * List current desktop applications and their top-level windows.
   *
   * The result is a snapshot at call time.
  */
  listApps(): DesktopApp[] {
    return callNative("desktop.listApps", {}, () =>
      loadNative().listDesktopApps().map(mapApp)
    );
  },

  /**
   * Find applications by process name or executable path substring.
   * @param substring Process name or path fragment, such as `"notepad"`.
  */
  findApps(substring: string): DesktopApp[] {
    return callNative("desktop.findApps", { substring }, () =>
      loadNative().findDesktopApps(substring).map(mapApp)
    );
  },

  /**
   * Find top-level windows by title substring.
   * @param substring Title fragment.
  */
  findWindows(substring: string): WindowInfo[] {
    return callNative("desktop.findWindows", { substring }, () =>
      loadNative().findWindowsByTitle(substring).map(mapWindow)
    );
  },

  /**
   * Poll until a top-level window title contains `substring`.
   *
   * @param substring Title fragment.
   * @param timeoutMs Timeout in milliseconds.
   * @param pollMs Poll interval. Native defaults are used when omitted.
   * @throws When no matching window appears before the timeout.
   */
  waitForWindow(
    substring: string,
    timeoutMs: number,
    pollMs?: number
  ): WindowInfo {
    return callNative(
      "desktop.waitForWindow",
      { substring, timeoutMs, pollMs },
      () => mapWindow(loadNative().waitForWindowByTitle(substring, timeoutMs, pollMs))
    );
  },

  /** Return the application that owns the current foreground window. */
  getForegroundApp(): DesktopApp {
    return callNative("desktop.getForegroundApp", {}, () =>
      mapApp(loadNative().getForegroundApp())
    );
  },
};
