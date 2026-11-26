import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type NativeAddonFailureKind =
  | "module-missing"
  | "asar-packed"
  | "missing-sibling-dll"
  | "missing-windows-vc-runtime"
  | "windows-dll-not-found"
  | "windows-proc-not-found"
  | "arch-mismatch"
  | "linux-glibc-mismatch"
  | "linux-shared-lib-missing"
  | "macos-dlopen-failed"
  | "unknown";

export type NativeAddonDiagnosticEnv = {
  platform?: NodeJS.Platform;
  arch?: string;
  osRelease?: string;
  systemRoot?: string;
  existsSync?: (targetPath: string) => boolean;
};

export type DiagnoseNativeAddonOptions = {
  component: string;
  packageName: string;
  siblingFiles?: readonly string[];
  windowsRuntimeDlls?: readonly string[];
  installCommand?: string;
  env?: NativeAddonDiagnosticEnv;
};

export type NativeAddonDiagnosis = {
  kind: NativeAddonFailureKind;
  summary: string;
  hint: string;
  message: string;
  context: Record<string, unknown>;
};

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function extractNodePath(rawMessage: string): string | undefined {
  const patterns = [
    /(\\\\\?\\[A-Za-z]:\\[^\r\n"'`<>|]+?\.node)(?=["'\s\r\n,);]|$)/i,
    /([A-Za-z]:[\\/][^\r\n"'`<>|]+?\.node)(?=["'\s\r\n,);]|$)/i,
    /(\/[^\r\n"'`<>|]+?\.node)(?=["'\s\r\n,);]|$)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(rawMessage);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function stripExtendedWinPrefix(filePath: string): string {
  return filePath.startsWith("\\\\?\\") ? filePath.slice(4) : filePath;
}

function safeExists(
  existsFn: (targetPath: string) => boolean,
  targetPath: string
): boolean | undefined {
  try {
    return existsFn(stripExtendedWinPrefix(targetPath));
  } catch {
    return undefined;
  }
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

function isWindowsModuleNotFound(rawMessage: string): boolean {
  return /The specified module could not be found|找不到指定的模块/i.test(rawMessage);
}

function isWindowsProcNotFound(rawMessage: string): boolean {
  return /The specified procedure could not be found|找不到指定的程序/i.test(rawMessage);
}

function extractMissingModule(rawMessage: string, code?: string): string | undefined {
  if (code === "ERR_DLOPEN_FAILED" || isWindowsModuleNotFound(rawMessage)) {
    return undefined;
  }
  const match = /Cannot find module ['"]([^'"]+)['"]/i.exec(rawMessage);
  if (match?.[1]) return match[1];
  return code === "MODULE_NOT_FOUND" ? rawMessage : undefined;
}

/**
 * Diagnose why a native `.node` addon failed to load and produce an actionable
 * message, concise hint, and structured context.
 */
export function diagnoseNativeAddonError(
  error: unknown,
  options: DiagnoseNativeAddonOptions
): NativeAddonDiagnosis {
  const rawMessage = rawErrorMessage(error);
  const code = errorCode(error);
  const platform = options.env?.platform ?? process.platform;
  const arch = options.env?.arch ?? process.arch;
  const osRelease = options.env?.osRelease ?? os.release();
  const systemRoot =
    options.env?.systemRoot ?? process.env.SystemRoot ?? "C:\\Windows";
  const existsFn = options.env?.existsSync ?? fs.existsSync;

  const installCommand =
    options.installCommand ??
    `npm install ${options.packageName} --include=optional`;
  const nodePath = extractNodePath(rawMessage);
  const normalizedNodePath = nodePath ? stripExtendedWinPrefix(nodePath) : undefined;
  const nodeFileExists = normalizedNodePath
    ? safeExists(existsFn, normalizedNodePath)
    : undefined;

  let kind: NativeAddonFailureKind = "unknown";
  let summary = `${options.component} native addon failed to load on ${platform}/${arch}.`;
  let hint = `Reinstall dependencies (${installCommand}) and verify native binary compatibility for ${platform}/${arch}.`;
  let missingModule: string | undefined;
  let missingSiblingDlls: string[] | undefined;
  let missingSystemDlls: string[] | undefined;
  let missingLibrary: string | undefined;

  const detectedMissingModule = extractMissingModule(rawMessage, code);
  if (detectedMissingModule) {
    kind = "module-missing";
    missingModule = detectedMissingModule;
    summary = `${options.component} package or native module could not be found (${detectedMissingModule}).`;
    hint = `Install dependencies with optional packages enabled: ${installCommand}.`;
  } else if (
    nodePath &&
    /\.asar([\\/]|$)/i.test(nodePath) &&
    !/\.asar\.unpacked([\\/]|$)/i.test(nodePath)
  ) {
    kind = "asar-packed";
    summary = `${options.component} native binary cannot be loaded directly from an .asar archive: ${nodePath}.`;
    hint = `Unpack native binaries outside app.asar (e.g. Electron asarUnpack: ["**/node_modules/${options.packageName}/**"]).`;
  } else if (platform === "win32" && isWindowsModuleNotFound(rawMessage)) {
    const siblingMissing: string[] = [];
    if (normalizedNodePath && nodeFileExists === true && options.siblingFiles?.length) {
      const dir = path.win32.dirname(normalizedNodePath);
      for (const sibling of options.siblingFiles) {
        if (safeExists(existsFn, path.win32.join(dir, sibling)) === false) {
          siblingMissing.push(sibling);
        }
      }
    }

    const systemMissing: string[] = [];
    if (options.windowsRuntimeDlls?.length) {
      for (const dll of options.windowsRuntimeDlls) {
        if (safeExists(existsFn, path.win32.join(systemRoot, "System32", dll)) === false) {
          systemMissing.push(dll);
        }
      }
    }

    if (siblingMissing.length > 0) {
      kind = "missing-sibling-dll";
      missingSiblingDlls = siblingMissing;
      summary = `${options.component} native binary exists at ${normalizedNodePath}, but required sibling file(s) are missing: ${siblingMissing.join(", ")}.`;
      hint = `Ensure all .node and .dll files in ${path.win32.dirname(normalizedNodePath!)} are deployed/unpacked together (for Electron, include "**/node_modules/${options.packageName}/**" in asarUnpack) and check antivirus quarantine.`;
    } else if (systemMissing.length > 0) {
      kind = "missing-windows-vc-runtime";
      missingSystemDlls = systemMissing;
      summary =
        nodeFileExists === true
          ? `${options.component} native binary exists at ${normalizedNodePath}, so Windows failed to load a required system DLL. Missing in System32: ${systemMissing.join(", ")}.`
          : `${options.component} failed to load because required Windows runtime DLL(s) are missing in System32: ${systemMissing.join(", ")}.`;
      hint =
        "Install or update the latest Microsoft Visual C++ 2015-2022 Redistributable (x64) (vc_redist.x64.exe) on this machine, then restart the application.";
    } else {
      kind = "windows-dll-not-found";
      summary =
        nodeFileExists === true
          ? `${options.component} native binary exists at ${normalizedNodePath}, but Windows failed to load one of its dependent DLLs (Win32 error 126).`
          : `${options.component} native binary or one of its dependent DLLs could not be loaded on Windows (Win32 error 126).`;
      hint = `Install or update Microsoft Visual C++ 2015-2022 Redistributable (x64), keep all sibling .dll files next to the .node file (including Electron asarUnpack), verify Windows version (${osRelease}; Windows 10 1809+ / Server 2019+ recommended), and check antivirus/EDR blocks.`;
    }
  } else if (platform === "win32" && isWindowsProcNotFound(rawMessage)) {
    kind = "windows-proc-not-found";
    summary = `${options.component} failed to resolve a required DLL entry point on Windows (Win32 error 127).`;
    hint =
      "Update Microsoft Visual C++ 2015-2022 Redistributable (x64) and check PATH for older conflicting DLL versions.";
  } else if (
    /not a valid Win32 application|不是有效的 Win32 应用程序|incompatible architecture|wrong ELF class/i.test(
      rawMessage
    )
  ) {
    kind = "arch-mismatch";
    summary = `${options.component} native binary does not match the current Node.js runtime architecture (${platform}/${arch}).`;
    hint = `Use a ${arch} Node.js runtime matching the native binary and reinstall dependencies (npm ci).`;
  } else if (/GLIBC_[0-9.]+.*not found|GLIBCXX_[0-9.]+.*not found/i.test(rawMessage)) {
    kind = "linux-glibc-mismatch";
    const matches = rawMessage.match(/GLIB(?:C|CXX)_[0-9.]+/g);
    if (matches?.length) {
      missingLibrary = [...new Set(matches)].join(", ");
    }
    summary = `${options.component} requires a newer GNU C/C++ runtime${missingLibrary ? ` (${missingLibrary})` : ""} than available on this Linux host.`;
    hint =
      "Upgrade glibc / libstdc++6 on the host, or run on a glibc-based Linux distribution rather than musl/Alpine.";
  } else {
    const soMatch = /([^\s:]+\.so(?:\.[0-9]+)*):\s*cannot open shared object file/i.exec(
      rawMessage
    );
    if (soMatch?.[1]) {
      kind = "linux-shared-lib-missing";
      missingLibrary = soMatch[1];
      summary = `${options.component} could not load shared library ${missingLibrary}.`;
      hint = `Install the system package providing ${missingLibrary} (or verify LD_LIBRARY_PATH includes its directory) and reinstall ${options.packageName}.`;
    } else if (platform === "darwin" && /Library not loaded|dlopen/i.test(rawMessage)) {
      kind = "macos-dlopen-failed";
      summary = `${options.component} native library failed to load on macOS (${arch}).`;
      hint = `Reinstall dependencies (${installCommand}) for macOS ${arch} and verify dynamic libraries are not quarantined or stripped.`;
    }
  }

  const message = [summary, `Hint: ${hint}`, `Original error: ${rawMessage}`].join("\n");

  return {
    kind,
    summary,
    hint,
    message,
    context: compactRecord({
      packageName: options.packageName,
      platform,
      arch,
      osRelease,
      failureKind: kind,
      nodePath: normalizedNodePath,
      nodeFileExists,
      missingSiblingDlls,
      missingSystemDlls,
      missingModule,
      missingLibrary,
    }),
  };
}
