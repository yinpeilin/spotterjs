/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Bridge to `@spotter-rs/node` (napi-rs). Types are generated in
 * `crates/spotter-node/index.d.ts` — do not hand-maintain a duplicate API list here.
 *
 * Prefer `screen`, `mouse`, `windowApi`, `desktop`, and `accessibility` for everyday use.
 */
import type * as Node from "@spotter-rs/node";

/** Full N-API module surface (auto-generated bindings). */
export type SpotterNative = typeof Node;

/** @deprecated Use `SpotterNative` */
export type NativeSpotter = SpotterNative;

export type NativeWindow = Node.JsWindowInfo;
export type NativeDesktopApp = Node.JsDesktopApp;
export type NativeCapture = Node.JsCaptureImage;
export type NativeMatchOptions = Node.JsMatchOptions;
export type NativePoint = Node.JsPoint;
export type NativeMouseConfig = Node.JsMouseConfig;
export type NativeKeyboardConfig = Node.JsKeyboardConfig;
export type NativeA11yConfig = Node.JsA11YConfig;
export type NativeA11yQuery = Node.JsA11YQuery;
export type NativeTreeHealth = Node.JsTreeHealth;
export type NativeAttachReport = Node.JsAttachReport;

let _native: SpotterNative | null = null;

export function loadNative(): SpotterNative {
  if (!_native) {
    _native = require("@spotter-rs/node") as SpotterNative;
  }
  return _native;
}
