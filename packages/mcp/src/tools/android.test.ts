import { beforeEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  listDevices: vi.fn(),
  connectTcp: vi.fn(),
  connect: vi.fn(),
  device: {
    capture: vi.fn(),
    tap: vi.fn(),
    swipe: vi.fn(),
    text: vi.fn(),
    keyevent: vi.fn(),
    back: vi.fn(),
    home: vi.fn(),
    startApp: vi.fn(),
    stopApp: vi.fn(),
    find: vi.fn(),
    findAll: vi.fn(),
  },
}));

vi.mock("@spotterjs/plugin-android-adb", () => ({
  android: {
    listDevices: plugin.listDevices,
    connectTcp: plugin.connectTcp,
    connect: plugin.connect,
  },
}));

vi.mock("@spotterjs/core", () => ({
  encodePngBase64: vi.fn(() => "png-base64"),
}));

import { registerAndroidTools } from "./android.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }> }>;

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };

  registerAndroidTools(server as never);
  return tools;
}

function parseToolJson(result: Awaited<ReturnType<ToolHandler>>) {
  const text = result.content[0]?.text;
  if (!text) throw new Error("tool did not return text content");
  return JSON.parse(text);
}

beforeEach(() => {
  plugin.listDevices.mockReset();
  plugin.connectTcp.mockReset();
  plugin.connect.mockReset();
  for (const fn of Object.values(plugin.device)) fn.mockReset();
  plugin.connect.mockResolvedValue(plugin.device);
  plugin.connectTcp.mockResolvedValue(plugin.device);
});

describe("android MCP tools", () => {
  it("registers android_list_devices", async () => {
    plugin.listDevices.mockResolvedValue([{ serial: "phone", state: "device" }]);

    const handler = registerTools().get("android_list_devices");
    expect(handler).toBeDefined();

    const json = parseToolJson(await handler!({}));

    expect(plugin.listDevices).toHaveBeenCalledWith({
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual([{ serial: "phone", state: "device" }]);
  });

  it("connects TCP devices", async () => {
    const handler = registerTools().get("android_connect_tcp");
    const json = parseToolJson(await handler!({ address: "10.0.0.2:5555" }));

    expect(plugin.connectTcp).toHaveBeenCalledWith("10.0.0.2:5555", {
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({ serial: undefined });
  });

  it("captures phone screen as base64 PNG", async () => {
    plugin.device.capture.mockResolvedValue({
      data: Buffer.from("rgba"),
      width: 2,
      height: 1,
    });

    const handler = registerTools().get("android_capture_screen");
    const result = await handler!({ serial: "phone" });
    const json = parseToolJson(result);

    expect(plugin.connect).toHaveBeenCalledWith({
      serial: "phone",
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({ serial: "phone", width: 2, height: 1 });
    expect(result.content[1]).toMatchObject({
      type: "image",
      data: "png-base64",
      mimeType: "image/png",
    });
  });

  it("runs input tools with required serial", async () => {
    const tools = registerTools();

    await tools.get("android_tap")!({ serial: "phone", x: 1, y: 2 });
    await tools.get("android_swipe")!({
      serial: "phone",
      from: { x: 1, y: 2 },
      to: { x: 3, y: 4 },
      durationMs: 200,
    });
    await tools.get("android_type_text")!({ serial: "phone", text: "hello" });
    await tools.get("android_keyevent")!({ serial: "phone", key: "BACK" });

    expect(plugin.device.tap).toHaveBeenCalledWith(1, 2);
    expect(plugin.device.swipe).toHaveBeenCalledWith(
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { durationMs: 200 }
    );
    expect(plugin.device.text).toHaveBeenCalledWith("hello");
    expect(plugin.device.keyevent).toHaveBeenCalledWith("BACK");
  });

  it("finds templates from path or base64", async () => {
    plugin.device.find.mockResolvedValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      center: { x: 2, y: 4 },
      score: 0.91,
    });

    const handler = registerTools().get("android_find_template");
    const json = parseToolJson(
      await handler!({
        serial: "phone",
        image: { base64: Buffer.from("needle").toString("base64") },
        confidence: 0.9,
      })
    );

    expect(plugin.device.find).toHaveBeenCalledWith(Buffer.from("needle"), {
      confidence: 0.9,
      searchRegion: undefined,
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.matches[0].score).toBe(0.91);
  });
});
