import type { DesktopApp, WindowInfo } from "@spotterjs/base";
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
 * 桌面应用与窗口 discovery（按进程聚合）。
 *
 * 适合「按进程名找窗口」「等待某标题窗口出现」等场景。
 * 窗口 ID 可用于 `windows`、`windows.findTemplate` 等。
 */
export const desktop = {
  /**
   * 列出当前所有桌面应用（含各进程下的窗口列表）。
   * 数据为调用时刻的快照。
   */
  listApps(): DesktopApp[] {
    return loadNative().listDesktopApps().map(mapApp);
  },

  /**
   * 按进程名或 exe 路径子串过滤应用（大小写策略由 native 层决定）。
   * @param substring 进程名 / 路径片段，如 `"notepad"` 或 `"WeChat"`
   */
  findApps(substring: string): DesktopApp[] {
    return loadNative().findDesktopApps(substring).map(mapApp);
  },

  /**
   * 按窗口标题子串搜索顶层窗口。
   * @param substring 标题片段
   */
  findWindows(substring: string): WindowInfo[] {
    return loadNative().findWindowsByTitle(substring).map(mapWindow);
  },

  /**
   * 轮询直到标题包含 `substring` 的窗口出现。
   *
   * @param substring 标题子串
   * @param timeoutMs 超时毫秒
   * @param pollMs 轮询间隔；省略则用 native 默认
   * @throws 超时未找到
   */
  waitForWindow(
    substring: string,
    timeoutMs: number,
    pollMs?: number
  ): WindowInfo {
    return mapWindow(
      loadNative().waitForWindowByTitle(substring, timeoutMs, pollMs)
    );
  },

  /** 返回当前拥有前台窗口的应用 */
  getForegroundApp(): DesktopApp {
    return mapApp(loadNative().getForegroundApp());
  },
};
