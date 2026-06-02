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

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function missingModuleName(error: unknown): string | null {
  const match = /Cannot find module ['"]([^'"]+)['"]/.exec(errorMessage(error));
  return match?.[1] ?? null;
}

function packageVersion(packageName: string): string | null {
  try {
    return require(`${packageName}/package.json`).version as string;
  } catch {
    return null;
  }
}

function platformLabel(): string {
  return `${process.platform}/${process.arch}`;
}

function nativeLoadError(error: unknown): Error {
  const missing = missingModuleName(error);
  const nodeVersion = packageVersion("@spotterjs/node");

  if (missing === "@spotterjs/node") {
    const wrapped = new Error(
      [
        "spotterjs could not load @spotterjs/node.",
        "@spotterjs/core depends on @spotterjs/node, so the installation is incomplete.",
        "Run `npm install @spotterjs/core --include=optional` or reinstall dependencies.",
        `Original error: ${errorMessage(error)}`,
      ].join("\n"),
    );
    (wrapped as Error & { cause?: unknown }).cause = error;
    return wrapped;
  }

  if (missing?.startsWith("@spotterjs/node-")) {
    const expected = nodeVersion ? `${missing}@${nodeVersion}` : missing;
    const wrapped = new Error(
      [
        `spotterjs native package is missing for ${platformLabel()}.`,
        `Expected optional package: ${expected}.`,
        "This usually means optional dependencies were omitted, or the matching native package was not published for the installed @spotterjs/node version.",
        `Try reinstalling with optional dependencies enabled: npm install ${expected} --include=optional`,
        nodeVersion
          ? `Maintainers: publish ${expected} before publishing @spotterjs/node@${nodeVersion}.`
          : "Maintainers: publish the matching native optional package before publishing @spotterjs/node.",
        `Original error: ${errorMessage(error)}`,
      ].join("\n"),
    );
    (wrapped as Error & { cause?: unknown }).cause = error;
    return wrapped;
  }

  return error instanceof Error ? error : new Error(String(error));
}

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
      throw nativeLoadError(error);
    }
  }
  return _native;
}
