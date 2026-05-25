import { beforeEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  discover: vi.fn(),
  pairTcp: vi.fn(),
  connectNetwork: vi.fn(),
  connectDefault: vi.fn(),
  connectAll: vi.fn(),
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
    dumpTree: vi.fn(),
    findElement: vi.fn(),
    waitForElement: vi.fn(),
    tapElement: vi.fn(),
    typeElement: vi.fn(),
    shell: vi.fn(),
    getDisplayInfo: vi.fn(),
    wake: vi.fn(),
    sleep: vi.fn(),
    currentApp: vi.fn(),
    clearApp: vi.fn(),
  },
  group: {
    devices: [{ serial: "phone-a" }, { serial: "phone-b" }],
    skipped: [],
    tapAll: vi.fn(),
    swipeAll: vi.fn(),
    captureAll: vi.fn(),
  },
}));

const artifacts = vi.hoisted(() => ({
  writeCaptureArtifact: vi.fn(),
}));

vi.mock("@spotterjs/plugin-android-adb", () => ({
  android: {
    discover: plugin.discover,
    pairTcp: plugin.pairTcp,
    connectNetwork: plugin.connectNetwork,
    connectDefault: plugin.connectDefault,
    connectAll: plugin.connectAll,
    connect: plugin.connect,
  },
}));

vi.mock("@spotterjs/core", () => ({
}));

vi.mock("../adapters/artifacts.js", () => artifacts);

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
  plugin.discover.mockReset();
  plugin.pairTcp.mockReset();
  plugin.connectNetwork.mockReset();
  plugin.connectDefault.mockReset();
  plugin.connectAll.mockReset();
  plugin.connect.mockReset();
  for (const fn of Object.values(plugin.device)) fn.mockReset();
  plugin.group.tapAll.mockReset();
  plugin.group.swipeAll.mockReset();
  plugin.group.captureAll.mockReset();
  artifacts.writeCaptureArtifact.mockReset();
  plugin.connect.mockResolvedValue(plugin.device);
  plugin.connectNetwork.mockResolvedValue({ serial: "192.168.1.8:42173" });
  plugin.connectDefault.mockResolvedValue({ serial: "phone" });
  plugin.connectAll.mockResolvedValue(plugin.group);
});

describe("android MCP tools", () => {
  it("discovers devices without requiring serial", async () => {
    plugin.discover.mockResolvedValue([
      { serial: "phone", state: "device", connection: "usb" },
    ]);

    const handler = registerTools().get("android_discover_devices");
    expect(handler).toBeDefined();

    const json = parseToolJson(await handler!({}));

    expect(plugin.discover).toHaveBeenCalledWith({
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual([{ serial: "phone", state: "device", connection: "usb" }]);
  });

  it("pairs and connects wireless devices", async () => {
    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_pair_tcp")!({
        host: "192.168.1.8",
        port: 37155,
        code: "123456",
      })
    );

    expect(plugin.pairTcp).toHaveBeenCalledWith({
      host: "192.168.1.8",
      port: 37155,
      code: "123456",
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({ ok: true });

    json = parseToolJson(
      await tools.get("android_connect_network")!({
        host: "192.168.1.8",
        port: 42173,
      })
    );

    expect(plugin.connectNetwork).toHaveBeenCalledWith({
      host: "192.168.1.8",
      port: 42173,
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({ serial: "192.168.1.8:42173" });
  });

  it("connects default and all devices from adb discovery", async () => {
    const tools = registerTools();

    let json = parseToolJson(await tools.get("android_connect_default")!({}));
    expect(plugin.connectDefault).toHaveBeenCalledWith({
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({ serial: "phone" });

    json = parseToolJson(await tools.get("android_connect_all")!({}));
    expect(plugin.connectAll).toHaveBeenCalledWith({
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({
      devices: [{ serial: "phone-a" }, { serial: "phone-b" }],
      skipped: [],
    });
  });

  it("captures phone screen as a workspace artifact", async () => {
    plugin.device.capture.mockResolvedValue({
      data: Buffer.from("rgba"),
      width: 2,
      height: 1,
    });
    artifacts.writeCaptureArtifact.mockReturnValue({
      imagePath: ".spotter/artifacts/android-phone.png",
      width: 2,
      height: 1,
      originalWidth: 2,
      originalHeight: 1,
      format: "png",
      isDownscaled: false,
    });

    const handler = registerTools().get("android_capture_screen");
    const result = await handler!({ serial: "phone" });
    const json = parseToolJson(result);

    expect(plugin.connect).toHaveBeenCalledWith({
      serial: "phone",
      adbPath: undefined,
      timeoutMs: undefined,
    });
    expect(json).toEqual({
      serial: "phone",
      imagePath: ".spotter/artifacts/android-phone.png",
      width: 2,
      height: 1,
      originalWidth: 2,
      originalHeight: 1,
      format: "png",
      isDownscaled: false,
    });
    expect(artifacts.writeCaptureArtifact).toHaveBeenCalledWith(
      {
        data: Buffer.from("rgba"),
        width: 2,
        height: 1,
      },
      { prefix: "android-phone" }
    );
  });

  it("runs batch capture and input tools", async () => {
    plugin.group.tapAll.mockResolvedValue([
      { serial: "phone-a", ok: true, value: undefined },
    ]);
    plugin.group.swipeAll.mockResolvedValue([
      { serial: "phone-a", ok: true, value: undefined },
    ]);
    plugin.group.captureAll.mockResolvedValue([
      {
        serial: "phone-a",
        ok: true,
        value: { data: Buffer.from("rgba"), width: 2, height: 1 },
      },
      { serial: "phone-b", ok: false, error: "offline" },
    ]);
    artifacts.writeCaptureArtifact.mockReturnValue({
      imagePath: ".spotter/artifacts/android-phone-a.png",
      width: 2,
      height: 1,
      originalWidth: 2,
      originalHeight: 1,
      format: "png",
      isDownscaled: false,
    });

    const tools = registerTools();

    let json = parseToolJson(await tools.get("android_batch_tap")!({ x: 1, y: 2 }));
    expect(plugin.group.tapAll).toHaveBeenCalledWith(1, 2);
    expect(json).toEqual([{ serial: "phone-a", ok: true }]);

    json = parseToolJson(
      await tools.get("android_batch_swipe")!({
        from: { x: 1, y: 2 },
        to: { x: 3, y: 4 },
        durationMs: 200,
      })
    );
    expect(plugin.group.swipeAll).toHaveBeenCalledWith(
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { durationMs: 200 }
    );
    expect(json).toEqual([{ serial: "phone-a", ok: true }]);

    const result = await tools.get("android_batch_capture")!({});
    json = parseToolJson(result);

    expect(plugin.group.captureAll).toHaveBeenCalled();
    expect(json).toEqual([
      {
        serial: "phone-a",
        ok: true,
        imagePath: ".spotter/artifacts/android-phone-a.png",
        width: 2,
        height: 1,
        originalWidth: 2,
        originalHeight: 1,
        format: "png",
        isDownscaled: false,
      },
      { serial: "phone-b", ok: false, error: "offline" },
    ]);
    expect(result.content).toHaveLength(1);
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
      region: undefined,
      scale: undefined,
    });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.matches[0].score).toBe(0.91);
  });

  it("dumps, finds, waits for, taps, and types Android elements", async () => {
    const element = {
      text: "Search",
      resourceId: "com.example:id/search",
      center: { x: 120, y: 60 },
      bounds: { left: 20, top: 30, width: 200, height: 60 },
      children: [],
      depth: 1,
      path: "0.0",
    };
    plugin.device.dumpTree.mockResolvedValue({
      text: "",
      children: [element],
      path: "0",
    });
    plugin.device.findElement.mockResolvedValue(element);
    plugin.device.waitForElement.mockResolvedValue(element);
    plugin.device.tapElement.mockResolvedValue(element);
    plugin.device.typeElement.mockResolvedValue(element);

    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_dump_tree")!({ serial: "phone", maxDepth: 4 })
    );
    expect(plugin.device.dumpTree).toHaveBeenCalledWith({ maxDepth: 4 });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.tree.children[0].text).toBe("Search");

    json = parseToolJson(
      await tools.get("android_find_element")!({
        serial: "phone",
        resourceIdContains: "search",
        clickable: true,
        maxDepth: 8,
      })
    );
    expect(plugin.device.findElement).toHaveBeenCalledWith(
      { resourceIdContains: "search", clickable: true },
      { maxDepth: 8 }
    );
    expect(json.element.resourceId).toBe("com.example:id/search");

    json = parseToolJson(
      await tools.get("android_wait_for_element")!({
        serial: "phone",
        text: "Search",
        timeoutMs: 1000,
        pollMs: 50,
      })
    );
    expect(plugin.device.waitForElement).toHaveBeenCalledWith(
      { text: "Search" },
      1000,
      { pollMs: 50 }
    );
    expect(json.coordinateSpace).toBe("android-device");

    await tools.get("android_tap_element")!({
      serial: "phone",
      text: "Search",
    });
    expect(plugin.device.tapElement).toHaveBeenCalledWith(
      { text: "Search" },
      {}
    );

    await tools.get("android_type_element")!({
      serial: "phone",
      resourceId: "com.example:id/search",
      textToType: "hello",
    });
    expect(plugin.device.typeElement).toHaveBeenCalledWith(
      { resourceId: "com.example:id/search" },
      "hello",
      {}
    );
  });

  it("runs Android shell and device management tools", async () => {
    plugin.device.shell.mockResolvedValue("ok\n");
    plugin.device.getDisplayInfo.mockResolvedValue({
      width: 1080,
      height: 2400,
      density: 420,
    });
    plugin.device.currentApp.mockResolvedValue({
      packageName: "com.example",
      activity: ".MainActivity",
      raw: "focus",
    });

    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_shell")!({ serial: "phone", command: "echo ok" })
    );
    expect(plugin.device.shell).toHaveBeenCalledWith("echo ok");
    expect(json).toEqual({ output: "ok\n" });

    json = parseToolJson(await tools.get("android_get_display_info")!({ serial: "phone" }));
    expect(plugin.device.getDisplayInfo).toHaveBeenCalled();
    expect(json.width).toBe(1080);

    await tools.get("android_wake")!({ serial: "phone" });
    await tools.get("android_sleep")!({ serial: "phone" });
    expect(plugin.device.wake).toHaveBeenCalled();
    expect(plugin.device.sleep).toHaveBeenCalled();

    json = parseToolJson(await tools.get("android_current_app")!({ serial: "phone" }));
    expect(plugin.device.currentApp).toHaveBeenCalled();
    expect(json.packageName).toBe("com.example");

    await tools.get("android_clear_app")!({
      serial: "phone",
      packageName: "com.example",
    });
    expect(plugin.device.clearApp).toHaveBeenCalledWith("com.example");
  });
});
