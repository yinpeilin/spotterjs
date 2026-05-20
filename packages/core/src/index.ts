export * from "@spotter/base";
export { screen, useMatchPlugin, getMatchProvider } from "./screen";
export { createNccMatchProvider } from "./match";
export { findInWindow, findAllInWindow, tapInWindow } from "./template";
export { loadNative } from "./native";
export { accessibility } from "./accessibility";
export type { A11yQuery, A11yConfig, TreeHealth, AttachReport } from "./accessibility";

import { loadNative } from "./native";
import { centerOf } from "@spotter/base";

export const mouse = {
  getPosition() {
    return loadNative().getPosition();
  },
  move(x: number, y: number) {
    loadNative().mouseMove(x, y);
  },
  click(button?: "left" | "right" | "middle") {
    loadNative().mouseClick(button);
  },
  tap(x: number, y: number, button?: "left" | "right" | "middle") {
    loadNative().tapAt(x, y, button);
  },
};

export const keyboard = {
  type(text: string) {
    loadNative().keyboardTypeText(text);
  },
  press(keys: string[]) {
    loadNative().keyboardPressKeys(keys);
  },
  shortcut(keys: string[]) {
    loadNative().keyboardShortcut(keys);
  },
};

export const clipboard = {
  set(text: string) {
    loadNative().clipboardSet(text);
  },
  get(): string {
    return loadNative().clipboardGet();
  },
};

export const windowApi = {
  list() {
    return loadNative().listWindows();
  },
  getActive() {
    return loadNative().getActiveWindow();
  },
  focus(id: string) {
    return loadNative().focusWindow(id);
  },
};

export { centerOf };
