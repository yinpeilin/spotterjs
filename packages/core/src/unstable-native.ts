/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Unstable bridge to the generated `@spotterjs/node` N-API bindings.
 *
 * Prefer high-level APIs such as `screen`, `mouse`, `windows`, `desktop`, and
 * `accessibility` for normal scripts. This entrypoint is for low-level
 * integrations or unwrapped native capabilities.
 */
import type * as Node from "@spotterjs/node";

/** Full generated N-API module type. */
export type SpotterNative = typeof Node;

/** @deprecated Use {@link SpotterNative}. */
export type NativeSpotter = SpotterNative;

/** @remarks Unstable native binding shape; prefer public types from `@spotterjs/base`. */
export type NativeWindow = Node.JsWindowInfo;
/** @remarks Unstable native binding shape; prefer public types from `@spotterjs/base`. */
export type NativeDesktopApp = Node.JsDesktopApp;
/** @remarks Unstable native binding shape; prefer public types from `@spotterjs/base`. */
export type NativeCapture = Node.JsCaptureImage;
/** @remarks Unstable native binding shape; prefer public types from `@spotterjs/base`. */
export type NativeMatchOptions = Node.JsMatchOptions;
export type NativePoint = Node.JsPoint;
export type NativeMouseConfig = Node.JsMouseConfig;
export type NativeKeyboardConfig = Node.JsKeyboardConfig;
export type NativeA11yConfig = Node.JsA11YConfig;
export type NativeA11yQuery = Node.JsA11YQuery;
export type NativeTreeHealth = Node.JsTreeHealth;
export type NativeAttachReport = Node.JsAttachReport;
export type {
  JsElementInfo as NativeElementInfo,
  JsTreeNodeDump as NativeTreeNodeDump,
} from "@spotterjs/node";

let _native: SpotterNative | null = null;

/**
 * Unstable native escape hatch for unwrapped native capabilities.
 *
 * @remarks Prefer `screen`, `mouse`, `keyboard`, `windows`, `desktop`, and
 * `accessibility` for normal automation code.
 */
export function loadNative(): SpotterNative {
  if (!_native) {
    _native = require("@spotterjs/node") as SpotterNative;
  }
  return _native;
}
