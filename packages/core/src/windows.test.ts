import { beforeEach, describe, expect, it, vi } from "vitest";

const listWindows = vi.fn();
const getActiveWindow = vi.fn();
const focusWindow = vi.fn();
const getWindowRegion = vi.fn();
const getWindowClientOrigin = vi.fn();
const captureWindow = vi.fn();
const findTemplateInWindow = vi.fn();
const findAllTemplatesInWindow = vi.fn();
const tapAt = vi.fn();
const waitForWindowByTitle = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    listWindows,
    getActiveWindow,
    focusWindow,
    getWindowRegion,
    getWindowClientOrigin,
    captureWindow,
    findTemplateInWindow,
    findAllTemplatesInWindow,
    tapAt,
    waitForWindowByTitle,
  }),
}));

import { windows } from "./windows";

const nativeWindow = {
  id: "123",
  idHex: "0x7b",
  title: "Notepad",
  region: { left: 10, top: 20, width: 300, height: 200 },
  processId: 42,
  processName: "notepad.exe",
  exePath: "C:\\Windows\\notepad.exe",
  isMinimized: false,
  isForeground: true,
};

beforeEach(() => {
  listWindows.mockReset();
  getActiveWindow.mockReset();
  focusWindow.mockReset();
  getWindowRegion.mockReset();
  getWindowClientOrigin.mockReset();
  captureWindow.mockReset();
  findTemplateInWindow.mockReset();
  findAllTemplatesInWindow.mockReset();
  tapAt.mockReset();
  waitForWindowByTitle.mockReset();
});

describe("windows", () => {
  it("lists and maps native windows", () => {
    listWindows.mockReturnValue([nativeWindow]);

    expect(windows.list()).toEqual([nativeWindow]);
  });

  it("waits for a title using an options object", () => {
    waitForWindowByTitle.mockReturnValue(nativeWindow);

    const win = windows.wait({
      titleContains: "Notepad",
      timeoutMs: 1_000,
      pollMs: 50,
    });

    expect(waitForWindowByTitle).toHaveBeenCalledWith("Notepad", 1_000, 50);
    expect(win).toEqual(nativeWindow);
  });

  it("finds templates within a window with new match options", () => {
    findTemplateInWindow.mockReturnValue({
      region: { left: 12, top: 24, width: 8, height: 10 },
      score: 0.94,
    });

    const match = windows.findTemplate("123", "button.png", {
      confidence: 0.9,
      scale: true,
    });

    expect(findTemplateInWindow).toHaveBeenCalledWith("123", "button.png", undefined, {
      confidence: 0.9,
      searchRegion: undefined,
      multiScale: true,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(match.center).toEqual({ x: 16, y: 29 });
  });

  it("taps a window template center and returns the match", () => {
    findTemplateInWindow.mockReturnValue({
      region: { left: 12, top: 24, width: 8, height: 10 },
      score: 0.94,
    });

    const match = windows.tapTemplate("123", "button.png");

    expect(tapAt).toHaveBeenCalledWith(16, 29);
    expect(match.center).toEqual({ x: 16, y: 29 });
  });

  it("waits for a window template and returns the first match", () => {
    findTemplateInWindow.mockReturnValue({
      region: { left: 12, top: 24, width: 8, height: 10 },
      score: 0.94,
    });

    const match = windows.waitForTemplate("123", "button.png", {
      timeoutMs: 1_000,
      intervalMs: 5,
    });

    expect(findTemplateInWindow).toHaveBeenCalledTimes(1);
    expect(match.center).toEqual({ x: 16, y: 29 });
  });

  it("retries window template matching until a match appears", () => {
    findTemplateInWindow
      .mockImplementationOnce(() => {
        throw new Error("no match");
      })
      .mockReturnValueOnce({
        region: { left: 12, top: 24, width: 8, height: 10 },
        score: 0.94,
      });

    const match = windows.waitForTemplate("123", "button.png", {
      timeoutMs: 1_000,
      intervalMs: 1,
    });

    expect(findTemplateInWindow).toHaveBeenCalledTimes(2);
    expect(match.center).toEqual({ x: 16, y: 29 });
  });

  it("throws the last error when the wait times out", () => {
    findTemplateInWindow.mockImplementation(() => {
      throw new Error("never matches");
    });

    expect(() =>
      windows.waitForTemplate("123", "button.png", {
        timeoutMs: 0,
        intervalMs: 1,
      })
    ).toThrow("never matches");
  });
});
