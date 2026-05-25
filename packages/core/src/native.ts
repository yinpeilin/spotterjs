/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 与 `@spotterjs/node`（napi-rs）的桥接层。
 *
 * 类型由 `crates/spotterjs-node/index.d.ts` 自动生成，请勿在此手写重复 API 列表。
 *
 * 日常开发请优先使用 `screen`、`mouse`、`windows`、`desktop`、`accessibility`；
 * 仅在需要内存 buffer 匹配、脚本级集成或尚未封装的 native 能力时调用 {@link loadNative}。
 */
import type * as Node from "@spotterjs/node";
import { createNativeLoadError } from "./native-error";

/** 完整 N-API 模块类型（自动生成绑定） */
/**
 * Unstable native escape-hatch surface. Prefer the high-level APIs exported
 * from `@spotterjs/core` unless you need an unwrapped native capability.
 *
 * @remarks The exact shape follows the generated `@spotterjs/node` bindings.
 */
export type SpotterNative = typeof Node;

/** @deprecated 请使用 {@link SpotterNative} */
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
export type { JsElementInfo as NativeElementInfo, JsTreeNodeDump as NativeTreeNodeDump } from "@spotterjs/node";

let _native: SpotterNative | null = null;

/**
 * 懒加载 native addon（单例）。
 *
 * 首次调用时 `require("@spotterjs/node")`；后续返回同一实例。
 * 需要平台对应的预编译二进制（Windows x64 / Linux x64-gnu）。
 */
/**
 * Unstable native escape hatch for unwrapped native capabilities.
 *
 * @remarks Prefer `screen`, `mouse`, `keyboard`, `windows`, `desktop`, and
 * `accessibility` for normal automation code.
 */
export function loadNative(): SpotterNative {
  if (!_native) {
    try {
      _native = require("@spotterjs/node") as SpotterNative;
    } catch (error) {
      throw createNativeLoadError(error);
    }
  }
  return _native;
}
