import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  play: vi.fn(),
}));

vi.mock("@spotterjs/core", () => ({
  recording: {
    start: core.start,
    stop: core.stop,
    play: core.play,
  },
}));

import { registerRecordingTools } from "./recording.js";
import { CommandRegistry } from "../registry.js";

type ToolHandler = (args: any) => Promise<import("./results.js").CommandResult>;

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerCleanup: vi.fn(),
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };
  registerRecordingTools(server as never);
  return tools;
}

function parseToolJson(result: Awaited<ReturnType<ToolHandler>>) {
  if (!result.success) throw new Error(result.error?.message);
  return result.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  core.start.mockReset();
  core.stop.mockReset();
  core.play.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("recording CLI tools", () => {
  it("cancels an active timed recording promptly and releases hooks before returning", async () => {
    vi.useFakeTimers();
    core.stop.mockReturnValue({ events: [], durationMs: 0 });
    const registry = new CommandRegistry();
    registerRecordingTools(registry);
    const controller = new AbortController();
    const pending = registry.execute("desktop_record_input", { durationMs: 300000 }, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(core.start).toHaveBeenCalledOnce();
    controller.abort(new Error("Command cancelled"));
    expect(await pending).toMatchObject({ success: false, error: { message: "desktop_record_input failed: Command cancelled" } });
    expect(core.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await registry.close();
    expect(core.stop).toHaveBeenCalledOnce();
  });

  it("records and returns a complete script within one invocation", async () => {
    vi.useFakeTimers();
    core.stop.mockReturnValue({ events: [], durationMs: 2000 });
    const registry = new CommandRegistry();
    registerRecordingTools(registry);
    const pending = registry.execute("desktop_record_input", { durationMs: 2000 });
    await vi.advanceTimersByTimeAsync(1999);
    expect(core.start).toHaveBeenCalledOnce();
    expect(core.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ success: true, data: { script: { events: [], durationMs: 2000 } } });
    await registry.close();
    expect(core.stop).toHaveBeenCalledOnce();
  });

  it("rejects invalid recording durations before starting native input hooks", async () => {
    const registry = new CommandRegistry();
    registerRecordingTools(registry);
    for (const durationMs of [0, -1, 300001])
      expect((await registry.execute("desktop_record_input", { durationMs })).success).toBe(false);
    expect(core.start).not.toHaveBeenCalled();
    await registry.close();
  });
  it("cleans up native recording when a process exits without an explicit stop", async () => {
    const registry = new CommandRegistry();
    registerRecordingTools(registry);
    await registry.execute("desktop_start_recording");
    expect(core.stop).not.toHaveBeenCalled();
    await registry.close();
    await registry.close();
    expect(core.stop).toHaveBeenCalledTimes(1);
  });

  it("does not stop a recording twice after an explicit stop", async () => {
    core.stop.mockReturnValue({ events: [], durationMs: 0 });
    const registry = new CommandRegistry();
    registerRecordingTools(registry);
    await registry.execute("desktop_start_recording");
    await registry.execute("desktop_stop_recording");
    await registry.close();
    expect(core.stop).toHaveBeenCalledTimes(1);
  });

  it("starts recording with options", async () => {
    const json = parseToolJson(
      await registerTools().get("desktop_start_recording")!({ moveThrottleMs: 20 })
    );

    expect(core.start).toHaveBeenCalledWith({ moveThrottleMs: 20 });
    expect(json).toEqual({ recording: true });
  });

  it("stops recording and returns the script", async () => {
    core.stop.mockReturnValue({
      events: [{ type: "type", text: "hi", delayMs: 10 }],
      durationMs: 10,
    });

    const json = parseToolJson(await registerTools().get("desktop_stop_recording")!({}));

    expect(core.stop).toHaveBeenCalledTimes(1);
    expect(json.script.events).toHaveLength(1);
    expect(json.scriptJson).toContain('"durationMs":10');
  });

  it("plays a recorded script", async () => {
    const script = { events: [], durationMs: 0 };

    const json = parseToolJson(
      await registerTools().get("desktop_play_recording")!({
        script,
        speed: 1.5,
      })
    );

    expect(core.play).toHaveBeenCalledWith(script, { speed: 1.5 });
    expect(json).toEqual({ played: true });
  });
});
