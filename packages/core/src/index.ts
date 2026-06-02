import { loadNative } from "./native";
import { centerOf } from "@spotterjs/base";

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

type DigitKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

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
  | DigitKey
  | LetterKey
  | FunctionKey
  | Lowercase<FunctionKey>
  | NamedKey
  | Lowercase<NamedKey>;

type KeyInput = KeyName | KeyName[];
type NumericKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type TapKeyInput = KeyName | NumericKey;

export type KeyboardTapOptions = {
  autoDelayMs?: number;
};

export type KeyboardWriteOptions = KeyboardTapOptions & {
  mode?: "paste" | "native";
  restoreClipboard?: boolean;
};

type NativeKeyboardConfig = {
  autoDelayMs?: number;
};

type NativeKeyboardWithConfig = ReturnType<typeof loadNative> & {
  keyboardTypeText(text: string, config?: NativeKeyboardConfig): void;
  keyboardTypeKey(key: string, config?: NativeKeyboardConfig): void;
  keyboardPressKeys(keys: string[], config?: NativeKeyboardConfig): void;
  keyboardReleaseKeys(keys: string[], config?: NativeKeyboardConfig): void;
};

const pressedKeys = new Set<string>();
let keyboardDefaultAutoDelayMs = 10;

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

function nativeKeyboard(): NativeKeyboardWithConfig {
  return loadNative() as NativeKeyboardWithConfig;
}

function nativeKeyboardConfig(options?: KeyboardTapOptions): NativeKeyboardConfig | undefined {
  return options?.autoDelayMs === undefined
    ? undefined
    : { autoDelayMs: options.autoDelayMs };
}

function effectiveKeyboardDelayMs(options?: KeyboardTapOptions): number {
  return options?.autoDelayMs ?? keyboardDefaultAutoDelayMs;
}

function sleepSync(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function callKeyboardTypeText(text: string, options?: KeyboardTapOptions) {
  const config = nativeKeyboardConfig(options);
  const n = nativeKeyboard();
  if (config) n.keyboardTypeText(text, config);
  else n.keyboardTypeText(text);
}

function callKeyboardTypeKey(key: string, options?: KeyboardTapOptions) {
  const config = nativeKeyboardConfig(options);
  const n = nativeKeyboard();
  if (config) n.keyboardTypeKey(key, config);
  else n.keyboardTypeKey(key);
}

function callKeyboardPressKeys(keys: string[], options?: KeyboardTapOptions) {
  const config = nativeKeyboardConfig(options);
  const n = nativeKeyboard();
  if (config) n.keyboardPressKeys(keys, config);
  else n.keyboardPressKeys(keys);
}

function callKeyboardReleaseKeys(keys: string[], options?: KeyboardTapOptions) {
  const config = nativeKeyboardConfig(options);
  const n = nativeKeyboard();
  if (config) n.keyboardReleaseKeys(keys, config);
  else n.keyboardReleaseKeys(keys);
}

function normalizeTapKey(key: TapKeyInput): string {
  if (typeof key === "number") {
    if (!Number.isInteger(key) || key < 0 || key > 9) {
      throw new RangeError(`keyboard.tap number key must be an integer from 0 to 9: ${key}`);
    }
    return String(key);
  }
  return String(key);
}

function pasteText(text: string, options?: KeyboardWriteOptions) {
  const shouldRestore = options?.restoreClipboard !== false;
  const n = loadNative();
  let previous: string | undefined;
  if (shouldRestore) {
    try {
      previous = n.clipboardGet();
    } catch {
      previous = undefined;
    }
  }
  n.clipboardSet(text);
  try {
    keyboard.hotkey(["Ctrl", "V"], options);
    sleepSync(effectiveKeyboardDelayMs(options));
  } finally {
    if (shouldRestore && previous !== undefined) {
      n.clipboardSet(previous);
    }
  }
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
  write(text: string, options?: KeyboardWriteOptions) {
    if (options?.mode === "native") {
      callKeyboardTypeText(text, options);
      return;
    }
    pasteText(text, options);
  },

  /** Type Unicode text. Alias for {@link keyboard.write}. */
  writeText(text: string, options?: KeyboardWriteOptions) {
    keyboard.write(text, options);
  },

  /** Press and release a single key. */
  tap(key: TapKeyInput, options?: KeyboardTapOptions) {
    callKeyboardTypeKey(normalizeTapKey(key), options);
  },

  /** Press one or more keys and track them as held. */
  down(keys: KeyInput, options?: KeyboardTapOptions) {
    const names = keyList(keys);
    callKeyboardPressKeys(names, options);
    for (const name of names) {
      pressedKeys.add(normalizeKeyName(name));
    }
  },

  /** Release keys recorded by {@link keyboard.down}; unknown keys are skipped. */
  up(keys: KeyInput, options?: KeyboardTapOptions) {
    const names = keyList(keys);
    const releasable = names
      .filter((name) => pressedKeys.has(normalizeKeyName(name)))
      .reverse();
    if (releasable.length === 0) return;
    callKeyboardReleaseKeys(releasable, options);
    for (const name of releasable) {
      pressedKeys.delete(normalizeKeyName(name));
    }
  },

  /** Send a native key-down event without recording local state. */
  rawDown(keys: KeyInput, options?: KeyboardTapOptions) {
    callKeyboardPressKeys(keyList(keys), options);
  },

  /** Send a native key-up event without checking local state. */
  rawUp(keys: KeyInput, options?: KeyboardTapOptions) {
    callKeyboardReleaseKeys(keyList(keys), options);
  },

  /** Press modifiers, tap the final key, then release the modifiers. */
  hotkey(keys: KeyName[], options?: KeyboardTapOptions) {
    if (keys.length === 0) return;
    if (keys.length === 1) {
      keyboard.tap(keys[0], options);
      return;
    }
    const modifiers = keys.slice(0, -1);
    const key = keys[keys.length - 1];
    keyboard.down(modifiers, options);
    try {
      keyboard.tap(key, options);
    } finally {
      keyboard.up(modifiers, options);
    }
  },

  /** @param config.autoDelayMs Delay between key events. */
  setConfig(config: { autoDelayMs?: number }) {
    keyboardDefaultAutoDelayMs = config.autoDelayMs ?? 10;
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
export {
  image,
  type ImageArtifact,
  type ImageFormat,
  type ImageSaveOptions,
  type ImageSize,
  type ImageSource,
} from "./image";
export {
  matchTapScreen,
  toLocal,
  toMatchBox,
  toScreen,
} from "./match-coords";
export type { MatchBox, WindowFrame } from "./match-coords";
