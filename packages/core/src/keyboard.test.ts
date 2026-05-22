import { describe, it, expect, vi, beforeEach } from "vitest";

const keyboardTypeText = vi.fn();
const keyboardTypeKey = vi.fn();
const keyboardPressKeys = vi.fn();
const keyboardReleaseKeys = vi.fn();
const setKeyboardConfig = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    keyboardTypeText,
    keyboardTypeKey,
    keyboardPressKeys,
    keyboardReleaseKeys,
    setKeyboardConfig,
  }),
}));

import { keyboard } from "./index";

beforeEach(() => {
  keyboardTypeText.mockReset();
  keyboardTypeKey.mockReset();
  keyboardPressKeys.mockReset();
  keyboardReleaseKeys.mockReset();
  setKeyboardConfig.mockReset();
});

describe("keyboard", () => {
  it("writes text through the native text input API", () => {
    keyboard.write("hello");
    expect(keyboardTypeText).toHaveBeenCalledWith("hello");
  });

  it("taps a single key", () => {
    keyboard.tap("Enter");
    expect(keyboardTypeKey).toHaveBeenCalledWith("Enter");
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
