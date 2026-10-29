import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";

const calls = vi.hoisted(() => ({
  enable: vi.fn(), disable: vi.fn(), configureHost: vi.fn(), desktop: vi.fn(),
  host: vi.fn(), ocr: vi.fn(), visual: vi.fn(), recording: vi.fn(), android: vi.fn(),
}));
vi.mock("@spotterjs/core", () => ({ accessibility: { enable: calls.enable, disable: calls.disable }, configureHost: calls.configureHost }));
vi.mock("./tools/desktop.js", () => ({ registerDesktopTools: calls.desktop }));
vi.mock("./tools/host.js", () => ({ registerHostTools: calls.host }));
vi.mock("./tools/ocr.js", () => ({ registerOcrTools: calls.ocr }));
vi.mock("./tools/visual.js", () => ({ registerVisualTools: calls.visual }));
vi.mock("./tools/recording.js", () => ({ registerRecordingTools: calls.recording }));
vi.mock("./tools/android.js", () => ({ registerAndroidTools: calls.android }));
import { createCommandRegistry } from "./runtime.js";

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["SPOTTERJS_A11Y", "SPOTTERJS_ANDROID", "SPOTTERJS_RECORDING", "SPOTTERJS_ALLOW_SHELL", "SPOTTERJS_WORKSPACE_ROOT"])
    vi.stubEnv(name, undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("CLI runtime scope", () => {
  it("discovers optional commands without enabling native accessibility", async () => {
    const registry = await createCommandRegistry({ all: true, discovery: true });
    expect(calls.enable).not.toHaveBeenCalled();
    expect(calls.configureHost).not.toHaveBeenCalled();
    expect(calls.desktop).toHaveBeenCalledWith(registry, true);
    expect(calls.android).toHaveBeenCalledWith(registry);
    expect(calls.recording).toHaveBeenCalledWith(registry);
    await registry.close();
    expect(calls.disable).not.toHaveBeenCalled();
  });

  it("enables accessibility before registering its operations and preserves opt-in groups", async () => {
    vi.stubEnv("SPOTTERJS_A11Y", "true");
    vi.stubEnv("SPOTTERJS_ANDROID", "1");
    vi.stubEnv("SPOTTERJS_RECORDING", "1");
    const registry = await createCommandRegistry();
    expect(calls.enable).toHaveBeenCalledOnce();
    expect(calls.enable.mock.invocationCallOrder[0]).toBeLessThan(calls.desktop.mock.invocationCallOrder[0]);
    expect(calls.android).toHaveBeenCalledWith(registry);
    expect(calls.recording).toHaveBeenCalledWith(registry);
    await registry.close();
    expect(calls.disable).toHaveBeenCalledOnce();
  });

  it("configures the explicit workspace and disables shell by default", async () => {
    const registry = await createCommandRegistry({ workspace: "relative-workspace" });
    const workspaceRoot = resolve("relative-workspace");
    expect(calls.configureHost).toHaveBeenCalledWith({ workspaceRoot, allowShell: false });
    expect(process.env.SPOTTERJS_WORKSPACE_ROOT).toBe(workspaceRoot);
    expect(calls.desktop).toHaveBeenCalledWith(registry, false);
    expect(calls.android).not.toHaveBeenCalled();
    expect(calls.recording).not.toHaveBeenCalled();
    await registry.close();
  });

  it("releases partially registered resources if setup fails", async () => {
    vi.stubEnv("SPOTTERJS_A11Y", "1");
    const cleanup = vi.fn();
    calls.host.mockImplementationOnce((registry) => registry.registerCleanup(cleanup));
    calls.ocr.mockImplementationOnce(() => { throw new Error("setup failure"); });
    await expect(createCommandRegistry()).rejects.toThrow("setup failure");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(calls.disable).toHaveBeenCalledOnce();
  });
});
