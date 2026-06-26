import { beforeEach, describe, expect, it, vi } from "vitest";

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

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };
  registerRecordingTools(server as never);
  return tools;
}

function parseToolJson(result: Awaited<ReturnType<ToolHandler>>) {
  const text = result.content[0]?.text;
  if (!text) throw new Error("tool did not return text content");
  return JSON.parse(text);
}

beforeEach(() => {
  vi.clearAllMocks();
  core.start.mockReset();
  core.stop.mockReset();
  core.play.mockReset();
});

describe("recording MCP tools", () => {
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
