import { loadNative } from "./native";
import { centerOf, type CaptureImage } from "@spotterjs/base";
import { encodePngBase64 } from "./capture";

type LetterKey =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

type FunctionKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12";

type NamedKey =
  | "Enter"
  | "Return"
  | "Tab"
  | "Escape"
  | "Esc"
  | "Space"
  | "Backspace"
  | "Delete"
  | "Up"
  | "Down"
  | "Left"
  | "Right"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Ctrl"
  | "Control"
  | "LeftControl"
  | "RightControl"
  | "Shift"
  | "LeftShift"
  | "RightShift"
  | "Alt"
  | "LeftAlt"
  | "RightAlt"
  | "Meta"
  | "Win"
  | "Cmd"
  | "LeftSuper"
  | "RightSuper";

/**
 * Keyboard key name accepted by high-level keyboard helpers.
 *
 * Prefer canonical names such as `Enter`, `Ctrl`, and `V`. Common lowercase
 * aliases such as `enter`, `ctrl`, and `esc` are kept for compatibility.
 */
export type KeyName =
  | LetterKey
  | FunctionKey
  | Lowercase<FunctionKey>
  | NamedKey
  | Lowercase<NamedKey>;

type KeyInput = KeyName | KeyName[];

const pressedKeys = new Set<string>();

function keyList(keys: KeyInput): string[] {
  return (Array.isArray(keys) ? keys : [keys]).map((key) => String(key));
}

function normalizeKeyName(key: string): string {
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  if (/^[a-z]$/.test(lower)) return lower.toUpperCase();
  const aliases: Record<string, string> = {
    enter: "Enter",
    return: "Enter",
    tab: "Tab",
    escape: "Escape",
    esc: "Escape",
    space: "Space",
    backspace: "Backspace",
    delete: "Delete",
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    ctrl: "Ctrl",
    control: "Ctrl",
    leftcontrol: "LeftControl",
    rightcontrol: "RightControl",
    shift: "Shift",
    leftshift: "LeftShift",
    rightshift: "RightShift",
    alt: "Alt",
    leftalt: "LeftAlt",
    rightalt: "RightAlt",
    meta: "Meta",
    win: "Win",
    cmd: "Cmd",
    leftsuper: "LeftSuper",
    rightsuper: "RightSuper",
  };
  if (/^f([1-9]|1[0-2])$/.test(lower)) return lower.toUpperCase();
  return aliases[lower] ?? trimmed;
}

/**
 * Mouse input helpers.
 *
 * Coordinates are screen pixels. Use {@link mouse.setConfig} to tune movement
 * speed and automatic delays.
 */
export const mouse = {
  /** Return the current cursor position in screen coordinates. */
  getPosition() {
    return loadNative().getPosition();
  },

  /** Move the cursor to `(x, y)` using native movement settings. */
  move(x: number, y: number) {
    loadNative().mouseMove(x, y);
  },

  /** Move the cursor through each point in order. */
  movePath(points: Array<{ x: number; y: number }>) {
    loadNative().mouseMovePath(points);
  },

  /** Move directly to `(x, y)` with a straight-line native movement. */
  moveStraight(x: number, y: number) {
    loadNative().mouseMoveStraight(x, y);
  },

  /** Click a mouse button. Defaults to the left button. */
  click(button?: "left" | "right" | "middle") {
    loadNative().mouseClick(button);
  },

  /** Double-click a mouse button. Defaults to the left button. */
  doubleClick(button?: "left" | "right" | "middle") {
    loadNative().mouseDoubleClick(button);
  },

  /** Press and hold a mouse button. */
  press(button?: "left" | "right" | "middle") {
    loadNative().mousePress(button);
  },

  /** Release a mouse button. */
  release(button?: "left" | "right" | "middle") {
    loadNative().mouseRelease(button);
  },

  /** Drag to `(x, y)` while holding a mouse button. */
  drag(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().mouseDrag(x, y, button);
  },

  /**
   * Scroll the mouse wheel.
   * @param direction Scroll direction.
   * @param amount Scroll amount. Defaults to `1`.
   */
  scroll(direction: "up" | "down" | "left" | "right", amount = 1) {
    const n = loadNative();
    switch (direction) {
      case "up":
        n.mouseScrollUp(amount);
        break;
      case "down":
        n.mouseScrollDown(amount);
        break;
      case "left":
        n.mouseScrollLeft(amount);
        break;
      case "right":
        n.mouseScrollRight(amount);
        break;
    }
  },

  /** Move to `(x, y)` and click. */
  tap(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().tapAt(x, y, button);
  },

  /**
   * Configure native mouse behavior.
   * @param config.autoDelayMs Delay between native input steps.
   * @param config.mouseSpeed Native mouse movement speed.
   */
  setConfig(config: { autoDelayMs?: number; mouseSpeed?: number }) {
    loadNative().setMouseConfig({
      autoDelayMs: config.autoDelayMs,
      mouseSpeed: config.mouseSpeed,
    });
  },
};

/**
 * Keyboard input helpers.
 *
 * `up()` releases only keys tracked by `down()`. Use `rawUp()` only when you
 * intentionally need to send a native key-up event without local state checks.
 */
export const keyboard = {
  /** Type Unicode text. */
  write(text: string) {
    loadNative().keyboardTypeText(text);
  },

  /** Press and release a single key. */
  tap(key: KeyName) {
    loadNative().keyboardTypeKey(String(key));
  },

  /** Press one or more keys and track them as held. */
  down(keys: KeyInput) {
    const names = keyList(keys);
    loadNative().keyboardPressKeys(names);
    for (const name of names) {
      pressedKeys.add(normalizeKeyName(name));
    }
  },

  /** Release keys recorded by {@link keyboard.down}; unknown keys are skipped. */
  up(keys: KeyInput) {
    const names = keyList(keys);
    const releasable = names
      .filter((name) => pressedKeys.has(normalizeKeyName(name)))
      .reverse();
    if (releasable.length === 0) return;
    loadNative().keyboardReleaseKeys(releasable);
    for (const name of releasable) {
      pressedKeys.delete(normalizeKeyName(name));
    }
  },

  /** Send a native key-down event without recording local state. */
  rawDown(keys: KeyInput) {
    loadNative().keyboardPressKeys(keyList(keys));
  },

  /** Send a native key-up event without checking local state. */
  rawUp(keys: KeyInput) {
    loadNative().keyboardReleaseKeys(keyList(keys));
  },

  /** Press modifiers, tap the final key, then release the modifiers. */
  hotkey(keys: KeyName[]) {
    if (keys.length === 0) return;
    if (keys.length === 1) {
      keyboard.tap(keys[0]);
      return;
    }
    const modifiers = keys.slice(0, -1);
    const key = keys[keys.length - 1];
    keyboard.down(modifiers);
    try {
      keyboard.tap(key);
    } finally {
      keyboard.up(modifiers);
    }
  },

  /** @param config.autoDelayMs Delay between key events. */
  setConfig(config: { autoDelayMs?: number }) {
    loadNative().setKeyboardConfig({ autoDelayMs: config.autoDelayMs });
  },
};

/** System clipboard text helpers. */
export const clipboard = {
  set(text: string) {
    loadNative().clipboardSet(text);
  },
  get(): string {
    return loadNative().clipboardGet();
  },
};

export { centerOf };

/**
 * Encode a {@link CaptureImage} as a Base64 PNG string.
 *
 * Equivalent to `encodePngBase64(capture)`. Useful for MCP and JSON payloads.
 */
export function captureToBase64(capture: CaptureImage): string {
  return encodePngBase64(capture);
}

export * from "@spotterjs/base";
export { screen } from "./screen";
export { windows } from "./windows";
export { accessibility } from "./accessibility";
export type {
  A11yQuery,
  A11yConfig,
  A11yDebugApi,
  A11yQuickApi,
  TreeHealth,
  AttachReport,
  TreeViewMode,
  TreeDumpOptions,
  ElementInfo,
  TreeNodeDump,
} from "./accessibility";
export { desktop } from "./desktop";
export { host, configureHost, HostPathError } from "./host";
export type { ShellInfo, ExecResult, DirEntry } from "./host";
export { SpotterJsError, NativeSpotterError, isSpotterJsError } from "./errors";
export type { SpotterErrorContext } from "./errors";
export { encodePng, encodePngBase64 } from "./capture";
export { image } from "./buffer-match";
export {
  matchTapScreen,
  toLocal,
  toMatchBox,
  toScreen,
} from "./match-coords";
export type { MatchBox, WindowFrame } from "./match-coords";
