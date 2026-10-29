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

import { keyboard, type KeyName } from "./index";

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
  it.each([
    "hello 中文 😀",
    "!@#$%^&*(){}[]\\\"'`~",
    "a\nb\r\nc\td",
    "Enter",
    "abc".repeat(10_000),
  ])("types literal text using native input by default", (text) => {
    keyboard.type(text, { autoDelayMs: 0 });
    expect(keyboardTypeText).toHaveBeenCalledWith(text, { autoDelayMs: 0 });
    expect(clipboardGet).not.toHaveBeenCalled();
    expect(clipboardSet).not.toHaveBeenCalled();
  });

  it("does nothing for empty text in either mode", () => {
    keyboard.write("");
    keyboard.write("", { mode: "paste" });
    expect(keyboardTypeText).not.toHaveBeenCalled();
    expect(clipboardSet).not.toHaveBeenCalled();
    expect(keyboardShortcut).not.toHaveBeenCalled();
  });

  it.each(["a\0b", "\uD800", "\uDC00"])(
    "rejects invalid text before emitting any input",
    (text) => {
      expect(() => keyboard.type(text)).toThrow("valid Unicode");
      expect(keyboardTypeText).not.toHaveBeenCalled();
      expect(clipboardSet).not.toHaveBeenCalled();
    }
  );

  it.each([NaN, Infinity, -1])("rejects invalid delays", (autoDelayMs) => {
    expect(() => keyboard.write("hello", { autoDelayMs })).toThrow("delays");
    expect(keyboardTypeText).not.toHaveBeenCalled();
  });

  it("allows extra time for slow paste targets", () => {
    const wait = vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    keyboard.write("hello", { mode: "paste", pasteDelayMs: 800 });
    expect(wait.mock.calls[0][3]).toBe(800);
    wait.mockRestore();
  });

  it("preserves new clipboard contents copied during a paste", () => {
    clipboardGet
      .mockReturnValueOnce("previous")
      .mockReturnValue("new user copy");
    keyboard.write("hello", { mode: "paste" });
    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
  });
  it("writes text by pasting through the clipboard and restores the previous clipboard", () => {
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");

    keyboard.write("hello", { mode: "paste" });

    expect(clipboardGet).toHaveBeenCalled();
    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "previous");
    expect(keyboardTypeText).not.toHaveBeenCalled();
  });

  it("waits long enough for paste-mode text to be consumed before restoring the clipboard", () => {
    const wait = vi.spyOn(Atomics, "wait").mockReturnValue("timed-out");
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");

    keyboard.write("hello", { mode: "paste" });

    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][3]).toBe(250);
    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(
      clipboardSet.mock.invocationCallOrder[1]
    );

    wait.mockRestore();
  });

  it("still writes text when the previous clipboard text is unavailable", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error(
        "[PLATFORM_ERROR] platform error: clipboard_get: clipboard is empty"
      );
    });

    keyboard.write("hello", { mode: "paste" });

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("restores an empty previous clipboard text", () => {
    clipboardGet.mockReturnValueOnce("").mockReturnValue("hello");

    keyboard.write("hello", { mode: "paste" });

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "");
  });

  it("can skip reading and restoring the clipboard in paste mode", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error("clipboard_get should not be called");
    });

    keyboard.write("hello", { mode: "paste", restoreClipboard: false });

    expect(clipboardGet).not.toHaveBeenCalled();
    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("restores the previous clipboard when paste hotkey typing fails", () => {
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");
    keyboardShortcut.mockImplementation(() => {
      throw new Error("native key failed");
    });

    expect(() => keyboard.write("hello", { mode: "paste" })).toThrow(
      "native key failed"
    );

    expect(clipboardSet).toHaveBeenNthCalledWith(1, "hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(clipboardSet).toHaveBeenNthCalledWith(2, "previous");
  });

  it("does not restore clipboard text that was unavailable when paste fails", () => {
    clipboardGet.mockImplementation(() => {
      throw new Error(
        "[PLATFORM_ERROR] platform error: clipboard_get: clipboard is empty"
      );
    });
    keyboardShortcut.mockImplementation(() => {
      throw new Error("native key failed");
    });

    expect(() => keyboard.write("hello", { mode: "paste" })).toThrow(
      "native key failed"
    );

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(clipboardSet).toHaveBeenCalledWith("hello");
    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
  });

  it("propagates clipboard set failures without sending the paste hotkey", () => {
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");
    clipboardSet.mockImplementationOnce(() => {
      throw new Error("clipboard_set failed");
    });

    expect(() => keyboard.write("hello", { mode: "paste" })).toThrow(
      "clipboard_set failed"
    );

    expect(clipboardSet).toHaveBeenCalledTimes(1);
    expect(keyboardPressKeys).not.toHaveBeenCalled();
    expect(keyboardTypeKey).not.toHaveBeenCalled();
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
    expect(keyboardShortcut).not.toHaveBeenCalled();
  });

  it("passes per-call delay through paste-mode hotkey calls", () => {
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");

    keyboard.write("hello", { mode: "paste", autoDelayMs: 30 });

    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"], {
      autoDelayMs: 30,
    });
  });

  it("uses the platform paste shortcut in paste mode", () => {
    const platform = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("darwin");
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");

    keyboard.write("hello", { mode: "paste" });

    expect(keyboardShortcut).toHaveBeenCalledWith(["Meta", "V"]);

    platform.mockRestore();
  });

  it("can write text through the native text input API with per-call delay", () => {
    keyboard.write("hello", { mode: "native", autoDelayMs: 30 });
    expect(keyboardTypeText).toHaveBeenCalledWith("hello", { autoDelayMs: 30 });
  });

  it("keeps writeText as an alias of write", () => {
    clipboardGet.mockReturnValueOnce("previous").mockReturnValue("hello");

    keyboard.writeText("hello");

    expect(keyboardTypeText).toHaveBeenCalledWith("hello");
    expect(clipboardSet).not.toHaveBeenCalled();
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

  it.each([
    ["Ctrl", "LeftControl"], ["LeftControl", "control"],
    ["Shift", "LeftShift"], ["LeftShift", "shift"],
    ["Alt", "LeftAlt"], ["LeftAlt", "alt"],
    ["Meta", "LeftSuper"], ["Win", "LeftSuper"], ["Cmd", "LeftSuper"],
    ["LeftSuper", "meta"],
  ])("releases the same physical modifier across aliases %s / %s", (down, up) => {
    keyboard.down(down as KeyName);
    keyboard.up(up as KeyName);
    expect(keyboardReleaseKeys).toHaveBeenCalledOnce();
    expect(keyboardReleaseKeys).toHaveBeenCalledWith([up]);
    keyboard.up(down as KeyName);
    expect(keyboardReleaseKeys).toHaveBeenCalledOnce();
  });

  it("keeps left and right modifiers distinct", () => {
    keyboard.down("RightControl");
    keyboard.up("Ctrl");
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
    keyboard.up("RightControl");
    expect(keyboardReleaseKeys).toHaveBeenCalledWith(["RightControl"]);
  });

  it("runs multi-key hotkeys through the native shortcut API", () => {
    keyboard.hotkey(["Ctrl", "V"]);

    expect(keyboardShortcut).toHaveBeenCalledWith(["Ctrl", "V"]);
    expect(keyboardPressKeys).not.toHaveBeenCalled();
    expect(keyboardTypeKey).not.toHaveBeenCalled();
    expect(keyboardReleaseKeys).not.toHaveBeenCalled();
  });
});
