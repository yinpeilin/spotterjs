import { describe, expect, it, vi } from "vitest";

describe("createNativeLoadError", () => {
  it("adds Windows guidance for a missing DLL dependency", async () => {
    vi.stubGlobal("process", {
      ...process,
      platform: "win32",
      arch: "x64",
    });

    const { createNativeLoadError } = await import("./native-error");
    const error = createNativeLoadError(
      Object.assign(new Error("The specified module could not be found."), {
        code: "ERR_DLOPEN_FAILED",
      })
    );

    expect(error.message).toContain(
      "Windows found the addon, but one of its DLL dependencies could not be loaded."
    );
    expect(error.message).toContain(
      "Install Microsoft Visual C++ Redistributable x64"
    );

    vi.unstubAllGlobals();
  });
});
