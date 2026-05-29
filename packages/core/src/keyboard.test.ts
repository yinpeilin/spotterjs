import { describe, it, expect, vi, beforeEach } from "vitest";

const keyboardTypeText = vi.fn();
const keyboardTypeKey = vi.fn();
const keyboardPressKeys = vi.fn();
const keyboardReleaseKeys = vi.fn();
const setKeyboardConfig = vi.fn();
const clipboardGet = vi.fn();
const clipboardSet = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    keyboardTypeText,
    keyboardTypeKey,
    keyboardPressKeys,
    keyboardReleaseKeys,
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
    expect(keyboardPressKeys).toHaveBeenCalledWith(["Ctrl"]);
    expect(keyboardTypeKey).toHaveBeenCalledWith("V");
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["Ctrl"]);
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "previous");
    expect(keyboardTypeText).not.toHaveBeenCalled();
  });

  it("can write text through the native text input API with per-call delay", () => {
    keyboard.write("hello", { mode: "native", autoDelayMs: 30 });
    expect(keyboardTypeText).toHaveBeenCalledWith("hello", { autoDelayMs: 30 });
  });

  it("exposes writeText as an alias of write", () => {
    clipboardGet.mockReturnValue("previous");

    keyboard.writeText("hello");

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardTypeKey).toHaveBeenCalledWith("V");
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

  it("releases tracked keys in reverse order and clears them", () => {
    keyboard.down(["Ctrl", "Shift", "A"]);

    expect(keyboardPressKeys).toHaveBeenCalledWith(["Ctrl", "Shift", "A"]);

    keyboard.up(["Ctrl", "Shift", "A"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["A", "Shift", "Ctrl"]);

    keyboard.up(["Ctrl", "Shift", "A"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledTimes(1);
  });

  it("uses rawUp to force a native key-up event", () => {
    keyboard.rawUp(["Ctrl"]);
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["Ctrl"]);
  });

  it("runs hotkeys as down modifiers, tap final key, then up modifiers", () => {
    keyboard.hotkey(["Ctrl", "V"]);

    expect(keyboardPressKeys).toHaveBeenCalledWith(["Ctrl"]);
    expect(keyboardTypeKey).toHaveBeenCalledWith("V");
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["Ctrl"]);
  });
});
