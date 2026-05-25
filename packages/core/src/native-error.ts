const NATIVE_MODULE = "@spotterjs/node";

export function createNativeLoadError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const parts = [
    `Failed to load ${NATIVE_MODULE} native binding on ${process.platform}/${process.arch}.`,
    detail ? `Original error: ${detail}` : "",
  ];

  if (process.platform === "win32") {
    if (code === "MODULE_NOT_FOUND" || /Cannot find module/i.test(detail)) {
      parts.push(
        "The native package is missing or incomplete. Reinstall dependencies, then run `npm rebuild @spotterjs/node`."
      );
    } else if (
      code === "ERR_DLOPEN_FAILED" ||
      /specified module could not be found/i.test(detail)
    ) {
      parts.push(
        "Windows found the addon, but one of its DLL dependencies could not be loaded."
      );
      parts.push(
        "Install Microsoft Visual C++ Redistributable x64, then rebuild the native package."
      );
    }
  }

  const wrapped = new Error(parts.filter(Boolean).join(" "));
  (wrapped as Error & { cause?: unknown }).cause = error;
  return wrapped;
}
