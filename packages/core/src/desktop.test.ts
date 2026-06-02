import { beforeEach, describe, expect, it, vi } from "vitest";

const listDesktopApps = vi.fn();
const findDesktopApps = vi.fn();
const findWindowsByTitle = vi.fn();
const waitForWindowByTitle = vi.fn();
const getForegroundApp = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    listDesktopApps,
    findDesktopApps,
    findWindowsByTitle,
    waitForWindowByTitle,
    getForegroundApp,
  }),
}));

import { desktop } from "./desktop";

const nativeWindow = {
  id: "123",
  idHex: "0x7b",
  title: "Notepad",
  region: { left: 10, top: 20, width: 300, height: 200 },
  processId: 42,
  processName: "notepad.exe",
  exePath: "C:\\Windows\\System32\\notepad.exe",
  isMinimized: false,
  isForeground: true,
};

const nativeApp = {
  processId: 42,
  processName: "notepad.exe",
  exePath: "C:\\Windows\\System32\\notepad.exe",
  windows: [nativeWindow],
  isForeground: true,
};

beforeEach(() => {
  listDesktopApps.mockReset();
  findDesktopApps.mockReset();
  findWindowsByTitle.mockReset();
  waitForWindowByTitle.mockReset();
  getForegroundApp.mockReset();
});

describe("desktop", () => {
  it("lists apps with mapped nested windows", () => {
    listDesktopApps.mockReturnValue([nativeApp]);

    expect(desktop.listApps()).toEqual([nativeApp]);
  });

  it("finds apps by substring and maps their windows", () => {
    findDesktopApps.mockReturnValue([nativeApp]);

    expect(desktop.findApps("note")).toEqual([nativeApp]);
    expect(findDesktopApps).toHaveBeenCalledWith("note");
  });

  it("finds and waits for windows by title", () => {
    findWindowsByTitle.mockReturnValue([nativeWindow]);
    waitForWindowByTitle.mockReturnValue(nativeWindow);

    expect(desktop.findWindows("Notepad")).toEqual([nativeWindow]);
    expect(desktop.waitForWindow("Notepad", 1_000, 50)).toEqual(nativeWindow);
    expect(waitForWindowByTitle).toHaveBeenCalledWith("Notepad", 1_000, 50);
  });

  it("returns the foreground app", () => {
    getForegroundApp.mockReturnValue(nativeApp);

    expect(desktop.getForegroundApp()).toEqual(nativeApp);
  });
});
