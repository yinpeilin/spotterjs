/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 与 `@spotter-rs/node`（napi-rs）的桥接层。
 *
 * 类型由 `crates/spotter-node/index.d.ts` 自动生成，请勿在此手写重复 API 列表。
 *
 * 日常开发请优先使用 {@link screen}、`mouse`、`windowApi`、`desktop`、`accessibility`；
 * 仅在需要内存 buffer 匹配、脚本级集成或尚未封装的 native 能力时调用 {@link loadNative}。
 */
import type * as Node from "@spotter-rs/node";

/** 完整 N-API 模块类型（自动生成绑定） */
export type SpotterNative = typeof Node;

/** @deprecated 请使用 {@link SpotterNative} */
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
export type { JsElementInfo as NativeElementInfo, JsTreeNodeDump as NativeTreeNodeDump } from "@spotter-rs/node";

let _native: SpotterNative | null = null;

/**
 * 懒加载 native addon（单例）。
 *
 * 首次调用时 `require("@spotter-rs/node")`；后续返回同一实例。
 * 需要平台对应的预编译二进制（Windows x64 / Linux x64-gnu）。
 */
export function loadNative(): SpotterNative {
  if (!_native) {
    _native = require("@spotter-rs/node") as SpotterNative;
  }
  return _native;
}
