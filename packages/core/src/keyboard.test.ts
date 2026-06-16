import { describe, it, expect, vi, beforeEach } from "vitest";

const keyboardTypeText = vi.fn();
const keyboardTypeKey = vi.fn();
const keyboardPressKeys = vi.fn();
const keyboardReleaseKeys = vi.fn();
const keyboardShortcut = vi.fn();
const setKeyboardConfig = vi.fn();
const clipboardGet = vi.fn();
const clipboardSet = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    keyboardTypeText,
    keyboardTypeKey,
    keyboardPressKeys,
    keyboardReleaseKeys,
    keyboardShortcut,
    setKeyboardConfig,
    clipboardGet,
    clipboardSet,
  }),
}));

import { keyboard } from "./index";

beforeEach(() => {
  keyboardTypeText.mockReset();
  keyboardTypeKey.mockReset();
  keyboardPressKeys.mockReset();
  keyboardReleaseKeys.mockReset();
  keyboardShortcut.mockReset();
  setKeyboardConfig.mockReset();
  clipboardGet.mockReset();
  clipboardSet.mockReset();
});

describe("keyboard", () => {
  it("writes text by pasting through the clipboard and restores the previous clipboard", () => {
    clipboardGet.mockReturnValue("previous");

    keyboard.write("hello");

    expect(clipboardGet).toHaveBeenCalled();
    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "previous");
    expect(keyboardTypeText).not.toHaveBeenCalled();
  });

  it("waits long enough for paste-mode text to be consumed before restoring the clipboard", () => {
    const wait = vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    clipboardGet.mockReturnValue("previous");

    keyboard.write("hello");

    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][3]).toBe(50);
    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(
      clipboardSet.mock.invocationCallOrder[1]
    );

    wait.mockRestore();
  });

  it("still writes text when the previous clipboard text is unavailable", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error("[PLATFORM_ERROR] platform error: clipboard_get: clipboard is empty");
    });

    keyboard.write("hello");

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("restores an empty previous clipboard text", () => {
    clipboardGet.mockReturnValue("");

    keyboard.write("hello");

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "");
  });

  it("can skip reading and restoring the clipboard in paste mode", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error("clipboard_get should not be called");
    });

    keyboard.write("hello", { restoreClipboard: false });

    expect(clipboardGet).not.toHaveBeenCalled();
    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("restores the previous clipboard when paste hotkey typing fails", () => {
    clipboardGet.mockReturnValue("previous");
    keyboardShortcut.mockImplementation(() => {
      throw new Error("native key failed");
    });

    expect(() => keyboard.write("hello")).toThrow("native key failed");

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "previous");
  });

  it("does not restore clipboard text that was unavailable when paste fails", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error("[PLATFORM_ERROR] platform error: clipboard_get: clipboard is empty");
    });
    keyboardShortcut.mockImplementation(() => {
      throw new Error("native key failed");
    });

    expect(() => keyboard.write("hello")).toThrow("native key failed");

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("propagates clipboard set failures without sending the paste hotkey", () => {
    clipboardGet.mockReturnValue("previous");
    clipboardSet.mockImplementationOnce(() => {
      throw new Error("clipboard_set failed");
    });

    expect(() => keyboard.write("hello")).toThrow("clipboard_set failed");

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(keyboardPressKeys).not.toHaveBeenCalled();
    expect(keyboardTypeKey).not.toHaveBeenCalled();
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
    expect(keyboardShortcut).not.toHaveBeenCalled();
  });

  it("passes per-call delay through paste-mode hotkey calls", () => {
    clipboardGet.mockReturnValue("previous");

    keyboard.write("hello", { autoDelayMs: 30 });

    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"], { autoDelayMs: 30 });
  });

  it("uses the platform paste shortcut in paste mode", () => {
    const platform = vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    clipboardGet.mockReturnValue("previous");

    keyboard.write("hello");

    expect(keyboardShortcut).toHaveBeenCalledWith(["Meta", "V"]);

    platform.mockRestore();
  });

  it("can write text through the native text input API with per-call delay", () => {
    keyboard.write("hello", { mode: "native", autoDelayMs: 30 });
    expect(keyboardTypeText).toHaveBeenCalledWith("hello", { autoDelayMs: 30 });
  });

  it("keeps writeText as an alias of write", () => {
    clipboardGet.mockReturnValue("previous");

    keyboard.writeText("hello");

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("does not touch the clipboard in native text input mode", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error("clipboard_get should not be called");
    });
    clipboardSet.mockImplementation(() => {
      throw new Error("clipboard_set should not be called");
    });

    keyboard.write("hello", { mode: "native" });

    expect(keyboardTypeText).toHaveBeenCalledWith("hello");
    expect(clipboardGet).not.toHaveBeenCalled();
    expect(clipboardSet).not.toHaveBeenCalled();
    expect(keyboardTypeKey).not.toHaveBeenCalled();
  });

  it("taps a single key", () => {
    keyboard.tap("Enter");
    expect(keyboardTypeKey).toHaveBeenCalledWith("Enter");
  });

  it("taps number keys", () => {
    keyboard.tap(1);
    keyboard.tap("2");

    expect(keyboardTypeKey).toHaveBeenNthCalledWith(1, "1");
    expect(keyboardTypeKey).toHaveBeenNthCalledWith(2, "2");
  });

  it("passes per-call delay to key taps", () => {
    keyboard.tap("Enter", { autoDelayMs: 20 });
    expect(keyboardTypeKey).toHaveBeenCalledWith("Enter", { autoDelayMs: 20 });
  });

  it("does not release keys that were not pressed through keyboard.down", () => {
    keyboard.up(["Ctrl"]);
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
  });

  it("passes tracked keys to native release once and lets native release them safely", () => {
    keyboard.down(["Ctrl", "Shift", "A"]);

    expect(keyboardPressKeys).toHaveBeenCalledWith(["Ctrl", "Shift", "A"]);

    keyboard.up(["Ctrl", "Shift", "A"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["Ctrl", "Shift", "A"]);

    keyboard.up(["Ctrl", "Shift", "A"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledTimes(1);
  });

  it("uses rawUp to force a native key-up event", () => {
    keyboard.rawUp(["Ctrl"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["Ctrl"]);
  });

  it("runs multi-key hotkeys through the native shortcut API", () => {
    keyboard.hotkey(["Ctrl", "V"]);

    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(keyboardPressKeys).not.toHaveBeenCalled();
    expect(keyboardTypeKey).not.toHaveBeenCalled();
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
  });
});
