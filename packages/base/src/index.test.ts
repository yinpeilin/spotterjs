import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  centerOf,
  diagnoseNativeAddonError,
  formatSpotterError,
  isSpotterError,
  SpotterError,
  toSpotterError,
} from "./index";
import type { MatchResult, TextMatchEvaluation } from "./index";

const nccMatch: MatchResult = {
  region: { left: 1, top: 2, width: 3, height: 4 },
  center: { x: 2, y: 4 },
  score: 0.94,
  matchScore: 0.94,
  matchAlgorithm: "ncc",
};

const textEvaluation: TextMatchEvaluation = {
  query: "Send",
  matched: true,
  matchScore: 1,
  matchAlgorithm: "ocr-text",
  matchKind: "exact",
};

void nccMatch;
void textEvaluation;

describe("centerOf", () => {
  it("returns midpoint for even width and height", () => {
    expect(centerOf({ left: 0, top: 0, width: 10, height: 10 })).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("returns midpoint for odd width and height", () => {
    expect(centerOf({ left: 0, top: 0, width: 11, height: 11 })).toEqual({
      x: 5,
      y: 5,
    });
  });

  it("offsets the center by the region origin", () => {
    expect(centerOf({ left: 100, top: 200, width: 40, height: 20 })).toEqual({
      x: 120,
      y: 210,
    });
  });

  it("supports negative origins", () => {
    expect(centerOf({ left: -20, top: -10, width: 10, height: 10 })).toEqual({
      x: -15,
      y: -5,
    });
  });
});

describe("SpotterError", () => {
  it("keeps a stable code, domain, context, and cause", () => {
    const cause = new Error("native failed");
    const error = new SpotterError(
      "SPOTTER_NATIVE_CAPTURE_FAILED",
      "capture failed",
      {
        cause,
        context: { api: "screen.capture" },
        domain: "native",
      }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SpotterError");
    expect(error.code).toBe("SPOTTER_NATIVE_CAPTURE_FAILED");
    expect(error.domain).toBe("native");
    expect(error.context).toEqual({ api: "screen.capture" });
    expect(error.cause).toBe(cause);
    expect(isSpotterError(error)).toBe(true);
  });

  it("recognizes structurally equivalent spotter errors", () => {
    expect(
      isSpotterError({
        name: "SpotterError",
        message: "failed",
        code: "SPOTTER_OCR_TEXT_NOT_FOUND",
      })
    ).toBe(true);
    expect(isSpotterError(new Error("plain"))).toBe(false);
  });

  it("rejects non-spotter shapes and primitives", () => {
    expect(isSpotterError(null)).toBe(false);
    expect(isSpotterError(undefined)).toBe(false);
    expect(isSpotterError("SPOTTER_X")).toBe(false);
    expect(
      isSpotterError({ name: "SpotterError", message: "x", code: "OOPS" })
    ).toBe(false);
    expect(
      isSpotterError({ name: "OtherError", message: "x", code: "SPOTTER_X" })
    ).toBe(false);
  });

  it("converts unknown thrown values into SpotterError", () => {
    const cause = new Error("boom");
    const error = toSpotterError(cause, {
      code: "SPOTTER_NATIVE_OPERATION_FAILED",
      context: { api: "screen.find" },
      domain: "native",
    });

    expect(error).toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_NATIVE_OPERATION_FAILED",
      message: "boom",
      context: { api: "screen.find" },
      domain: "native",
    });
    expect(error.cause).toBe(cause);
  });

  it("returns the same instance for an existing SpotterError", () => {
    const original = new SpotterError("SPOTTER_OCR_TEXT_NOT_FOUND", "missing");
    expect(toSpotterError(original)).toBe(original);
  });

  it("rebuilds structural spotter errors and preserves code and context", () => {
    const structural = {
      name: "SpotterError",
      message: "structural failure",
      code: "SPOTTER_NATIVE_CAPTURE_FAILED",
      context: { api: "windows.capture" },
      domain: "native",
    };

    const error = toSpotterError(structural);

    expect(error).toBeInstanceOf(SpotterError);
    expect(error.code).toBe("SPOTTER_NATIVE_CAPTURE_FAILED");
    expect(error.context).toEqual({ api: "windows.capture" });
    expect(error.domain).toBe("native");
    expect(error.cause).toBe(structural);
  });

  it("defaults unknown non-error values to SPOTTER_UNKNOWN_ERROR", () => {
    const error = toSpotterError("just a string");

    expect(error.code).toBe("SPOTTER_UNKNOWN_ERROR");
    expect(error.message).toBe("just a string");
    expect(error.cause).toBe("just a string");
  });

  it("uses an explicit message override for unknown values", () => {
    const error = toSpotterError({ weird: true }, { message: "overridden" });

    expect(error.code).toBe("SPOTTER_UNKNOWN_ERROR");
    expect(error.message).toBe("overridden");
  });

  it("keeps and formats optional hint without mutating error.message", () => {
    const error = new SpotterError("SPOTTER_OCR_TEXT_NOT_FOUND", "OCR text not found: Send", {
      domain: "ocr",
      hint: "Try minSimilarity or preprocess: true.",
    });

    expect(error.message).toBe("OCR text not found: Send");
    expect(error.hint).toBe("Try minSimilarity or preprocess: true.");
    expect(formatSpotterError(error)).toBe(
      "[SPOTTER_OCR_TEXT_NOT_FOUND] OCR text not found: Send\nHint: Try minSimilarity or preprocess: true."
    );

    const rebuilt = toSpotterError({
      name: "SpotterError",
      code: "SPOTTER_OCR_TEXT_NOT_FOUND",
      message: "OCR text not found: Send",
      hint: "Structural hint",
    });
    expect(rebuilt.hint).toBe("Structural hint");
    expect(formatSpotterError(new Error("plain"))).toBe("plain");
  });
});

describe("diagnoseNativeAddonError", () => {
  const nodePath =
    "C:\\app\\node_modules\\onnxruntime-node\\bin\\napi-v6\\win32\\x64\\onnxruntime_binding.node";
  const win126Error = Object.assign(
    new Error(`The specified module could not be found.\r\n\\\\?\\${nodePath}`),
    { code: "ERR_DLOPEN_FAILED" }
  );

  it("identifies missing Windows VC++ runtime DLLs when .node and sibling DLLs exist", () => {
    const diagnosis = diagnoseNativeAddonError(win126Error, {
      component: "ONNX Runtime",
      packageName: "onnxruntime-node",
      siblingFiles: ["onnxruntime.dll"],
      windowsRuntimeDlls: ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140_atomic_wait.dll"],
      env: {
        platform: "win32",
        arch: "x64",
        osRelease: "10.0.19045",
        systemRoot: "C:\\Windows",
        existsSync: (target) => {
          if (target === nodePath) return true;
          if (target === "C:\\app\\node_modules\\onnxruntime-node\\bin\\napi-v6\\win32\\x64\\onnxruntime.dll") {
            return true;
          }
          return target.endsWith("\\vcruntime140.dll");
        },
      },
    });

    expect(diagnosis.kind).toBe("missing-windows-vc-runtime");
    expect(diagnosis.context).toMatchObject({
      failureKind: "missing-windows-vc-runtime",
      nodePath,
      nodeFileExists: true,
      missingSystemDlls: ["vcruntime140_1.dll", "msvcp140_atomic_wait.dll"],
    });
    expect(diagnosis.message).toContain("exists at");
    expect(diagnosis.hint).toContain("Visual C++ 2015-2022 Redistributable");
  });

  it("identifies missing sibling DLLs next to the .node binary", () => {
    const diagnosis = diagnoseNativeAddonError(win126Error, {
      component: "ONNX Runtime",
      packageName: "onnxruntime-node",
      siblingFiles: ["onnxruntime.dll"],
      windowsRuntimeDlls: ["vcruntime140.dll"],
      env: {
        platform: "win32",
        arch: "x64",
        existsSync: (target) => target === nodePath || target.endsWith("\\vcruntime140.dll"),
      },
    });

    expect(diagnosis.kind).toBe("missing-sibling-dll");
    expect(diagnosis.context.missingSiblingDlls).toEqual(["onnxruntime.dll"]);
    expect(diagnosis.hint).toContain("asarUnpack");
  });

  it("falls back to windows-dll-not-found when .node exists and probed DLLs are present", () => {
    const diagnosis = diagnoseNativeAddonError(win126Error, {
      component: "ONNX Runtime",
      packageName: "onnxruntime-node",
      siblingFiles: ["onnxruntime.dll"],
      windowsRuntimeDlls: ["vcruntime140.dll"],
      env: {
        platform: "win32",
        arch: "x64",
        osRelease: "10.0.19045",
        existsSync: () => true,
      },
    });

    expect(diagnosis.kind).toBe("windows-dll-not-found");
    expect(diagnosis.message).toContain("Win32 error 126");
  });

  it("detects .asar-packed native addons", () => {
    const asarError = new Error(
      "The specified module could not be found.\r\nC:\\app\\resources\\app.asar\\node_modules\\onnxruntime-node\\bin\\napi-v6\\win32\\x64\\onnxruntime_binding.node"
    );
    const diagnosis = diagnoseNativeAddonError(asarError, {
      component: "ONNX Runtime",
      packageName: "onnxruntime-node",
      env: { platform: "win32", arch: "x64", existsSync: () => false },
    });

    expect(diagnosis.kind).toBe("asar-packed");
    expect(diagnosis.hint).toContain("asarUnpack");
  });

  it("detects Windows procedure-not-found, architecture mismatch, Linux shared libs, glibc, and missing modules", () => {
    const procErr = diagnoseNativeAddonError(
      new Error("The specified procedure could not be found."),
      {
        component: "ONNX Runtime",
        packageName: "onnxruntime-node",
        env: { platform: "win32", arch: "x64" },
      }
    );
    expect(procErr.kind).toBe("windows-proc-not-found");

    const archErr = diagnoseNativeAddonError(
      new Error("%1 is not a valid Win32 application."),
      {
        component: "ONNX Runtime",
        packageName: "onnxruntime-node",
        env: { platform: "win32", arch: "ia32" },
      }
    );
    expect(archErr.kind).toBe("arch-mismatch");

    const soErr = diagnoseNativeAddonError(
      new Error("libonnxruntime.so.1: cannot open shared object file: No such file or directory"),
      {
        component: "ONNX Runtime",
        packageName: "onnxruntime-node",
        env: { platform: "linux", arch: "x64" },
      }
    );
    expect(soErr.kind).toBe("linux-shared-lib-missing");
    expect(soErr.context.missingLibrary).toBe("libonnxruntime.so.1");

    const glibcErr = diagnoseNativeAddonError(
      new Error("/lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.34' not found"),
      {
        component: "ONNX Runtime",
        packageName: "onnxruntime-node",
        env: { platform: "linux", arch: "x64" },
      }
    );
    expect(glibcErr.kind).toBe("linux-glibc-mismatch");
    expect(glibcErr.context.missingLibrary).toBe("GLIBC_2.34");

    const modErr = diagnoseNativeAddonError(
      Object.assign(new Error("Cannot find module 'onnxruntime-node'"), {
        code: "MODULE_NOT_FOUND",
      }),
      {
        component: "ONNX Runtime",
        packageName: "onnxruntime-node",
        env: { platform: "linux", arch: "x64" },
      }
    );
    expect(modErr.kind).toBe("module-missing");
    expect(modErr.context.missingModule).toBe("onnxruntime-node");
  });
});

describe("package exports", () => {
  it("publishes only the root entrypoint and package metadata", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

    expect(pkg.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        require: "./dist/index.js",
        default: "./dist/index.js",
      },
      "./package.json": "./package.json",
    });
  });
});
