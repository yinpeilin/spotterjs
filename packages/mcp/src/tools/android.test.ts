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
  workspaceImageStore: {
    writeCapture: vi.fn(),
  },
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

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;
type RegisteredTool = { config: any; handler: ToolHandler };

function registerToolEntries(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, config: unknown, handler: ToolHandler) {
      tools.set(name, { config, handler });
    },
  };

  registerAndroidTools(server as never);
  return tools;
}

function registerTools(): Map<string, ToolHandler> {
  return new Map(
    [...registerToolEntries()].map(([name, entry]) => [name, entry.handler])
  );
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
  artifacts.workspaceImageStore.writeCapture.mockReset();
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
    artifacts.workspaceImageStore.writeCapture.mockReturnValue({
      imagePath: ".spotter/artifacts/android-phone.png",
      width: 2,
      height: 1,
      originalWidth: 2,
      originalHeight: 1,
      format: "png",
      isDownscaled: false,
      detail: "original",
    });

    const handler = registerTools().get("android_capture_screen");
    const result = await handler!({ serial: "phone", detail: "original" });
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
      detail: "original",
    });
    expect(artifacts.workspaceImageStore.writeCapture).toHaveBeenCalledWith(
      {
        data: Buffer.from("rgba"),
        width: 2,
        height: 1,
      },
      { prefix: "android-phone", detail: "original" }
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
    artifacts.workspaceImageStore.writeCapture.mockReturnValue({
      imagePath: ".spotter/artifacts/android-phone-a.png",
      width: 2,
      height: 1,
      originalWidth: 2,
      originalHeight: 1,
      format: "png",
      isDownscaled: false,
      detail: "original",
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

    const result = await tools.get("android_batch_capture")!({
      detail: "original",
    });
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
        detail: "original",
      },
      { serial: "phone-b", ok: false, error: "offline" },
    ]);
    expect(artifacts.workspaceImageStore.writeCapture).toHaveBeenCalledWith(
      { data: Buffer.from("rgba"), width: 2, height: 1 },
      { prefix: "android-phone-a", detail: "original" }
    );
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

  it("uses bounded numeric schemas for coordinates and timeouts", () => {
    const tools = registerToolEntries();
    const tapSchema = tools.get("android_tap")!.config.inputSchema;
    const waitSchema = tools.get("android_wait_for_element")!.config.inputSchema;
    const captureSchema = tools.get("android_capture_screen")!.config.inputSchema;

    expect(() =>
      tapSchema.x.parse(Number.NaN)
    ).toThrow();
    expect(() =>
      tapSchema.x.parse(Number.POSITIVE_INFINITY)
    ).toThrow();
    expect(() =>
      waitSchema.waitTimeoutMs.parse(-1)
    ).toThrow();
    expect(captureSchema.detail.parse("high")).toBe("high");
    expect(captureSchema.detail.parse("original")).toBe("original");
    expect(() => captureSchema.detail.parse("low")).toThrow();
  });

  it("finds templates from path, base64, or all matches", async () => {
    plugin.device.find.mockResolvedValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      center: { x: 2, y: 4 },
      score: 0.91,
    });
    plugin.device.findAll.mockResolvedValue([
      {
        region: { left: 5, top: 6, width: 7, height: 8 },
        center: { x: 8, y: 10 },
        score: 0.95,
      },
    ]);

    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_find_template")!({
        serial: "phone",
        image: { path: "needle.png" },
        confidence: 0.8,
      })
    );

    expect(plugin.device.find).toHaveBeenCalledWith("needle.png", {
      confidence: 0.8,
      region: undefined,
      scale: undefined,
    });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.matches[0].score).toBe(0.91);

    json = parseToolJson(
      await tools.get("android_find_template")!({
        serial: "phone",
        image: { base64: Buffer.from("needle").toString("base64") },
        confidence: 0.9,
      })
    );

    expect(plugin.device.find).toHaveBeenLastCalledWith(Buffer.from("needle"), {
      confidence: 0.9,
      region: undefined,
      scale: undefined,
    });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.matches[0].score).toBe(0.91);

    json = parseToolJson(
      await tools.get("android_find_template")!({
        serial: "phone",
        image: { path: "needle.png" },
        all: true,
        confidence: 0.9,
      })
    );

    expect(plugin.device.findAll).toHaveBeenCalledWith("needle.png", {
      confidence: 0.9,
      region: undefined,
      scale: undefined,
    });
    expect(json.coordinateSpace).toBe("android-device");
    expect(json.matches[0].score).toBe(0.95);
  });

  it("forwards template matching confidence, region, and scale options", async () => {
    const region = { left: 10, top: 20, width: 300, height: 400 };
    const scale = { min: 0.75, max: 1.25, step: 0.05 };
    plugin.device.find.mockResolvedValue({
      region: { left: 11, top: 22, width: 33, height: 44 },
      center: { x: 27, y: 44 },
      score: 0.87,
    });

    const result = await registerTools().get("android_find_template")!({
      serial: "phone",
      adbPath: "adb.exe",
      timeoutMs: 2500,
      image: { path: "needle.png" },
      confidence: 0.87,
      region,
      scale,
    });
    const json = parseToolJson(result);

    expect(plugin.connect).toHaveBeenCalledWith({
      serial: "phone",
      adbPath: "adb.exe",
      timeoutMs: 2500,
    });
    expect(plugin.device.find).toHaveBeenCalledWith("needle.png", {
      confidence: 0.87,
      region,
      scale,
    });
    expect(json).toEqual({
      coordinateSpace: "android-device",
      matches: [
        {
          region: { left: 11, top: 22, width: 33, height: 44 },
          center: { x: 27, y: 44 },
          score: 0.87,
        },
      ],
    });
  });

  it("uses findAll with scale true when all template matches are requested", async () => {
    plugin.device.findAll.mockResolvedValue([
      {
        region: { left: 1, top: 2, width: 3, height: 4 },
        center: { x: 2, y: 4 },
        score: 0.91,
      },
      {
        region: { left: 5, top: 6, width: 7, height: 8 },
        center: { x: 8, y: 10 },
        score: 0.99,
      },
    ]);

    const json = parseToolJson(
      await registerTools().get("android_find_template")!({
        serial: "phone",
        image: { path: "needle.png" },
        all: true,
        confidence: 1,
        scale: true,
      })
    );

    expect(plugin.device.find).not.toHaveBeenCalled();
    expect(plugin.device.findAll).toHaveBeenCalledWith("needle.png", {
      confidence: 1,
      region: undefined,
      scale: true,
    });
    expect(json).toEqual({
      coordinateSpace: "android-device",
      matches: [
        {
          region: { left: 1, top: 2, width: 3, height: 4 },
          center: { x: 2, y: 4 },
          score: 0.91,
        },
        {
          region: { left: 5, top: 6, width: 7, height: 8 },
          center: { x: 8, y: 10 },
          score: 0.99,
        },
      ],
    });
  });

  it("returns an empty Android template match list with coordinate space", async () => {
    plugin.device.findAll.mockResolvedValue([]);

    const json = parseToolJson(
      await registerTools().get("android_find_template")!({
        serial: "phone",
        image: { path: "needle.png" },
        all: true,
        confidence: 0,
      })
    );

    expect(json).toEqual({
      coordinateSpace: "android-device",
      matches: [],
    });
  });

  it("uses bounded schemas for template matching accuracy options", () => {
    const findSchema = registerToolEntries().get("android_find_template")!.config.inputSchema;

    expect(findSchema.confidence.parse(0)).toBe(0);
    expect(findSchema.confidence.parse(1)).toBe(1);
    expect(() => findSchema.confidence.parse(-0.01)).toThrow();
    expect(() => findSchema.confidence.parse(1.01)).toThrow();
    expect(() => findSchema.confidence.parse(Number.NaN)).toThrow();
    expect(() => findSchema.confidence.parse(Number.POSITIVE_INFINITY)).toThrow();

    expect(() =>
      findSchema.region.parse({ left: -1, top: 0, width: 1, height: 1 })
    ).toThrow();
    expect(() =>
      findSchema.region.parse({ left: 0, top: -1, width: 1, height: 1 })
    ).toThrow();
    expect(() =>
      findSchema.region.parse({ left: 0, top: 0, width: 0, height: 1 })
    ).toThrow();
    expect(() =>
      findSchema.region.parse({ left: 0, top: 0, width: 1, height: -1 })
    ).toThrow();
    expect(() =>
      findSchema.region.parse({
        left: 0,
        top: 0,
        width: Number.POSITIVE_INFINITY,
        height: 1,
      })
    ).toThrow();

    expect(() => findSchema.scale.parse({ min: 0 })).toThrow();
    expect(() => findSchema.scale.parse({ max: -1 })).toThrow();
    expect(() => findSchema.scale.parse({ step: Number.NaN })).toThrow();
    expect(() => findSchema.scale.parse({ step: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("returns an MCP error when high-confidence template matching misses", async () => {
    plugin.device.find.mockRejectedValue(
      new Error("best score 0.94 below confidence 0.99")
    );

    const result = await registerTools().get("android_find_template")!({
      serial: "phone",
      image: { path: "needle.png" },
      confidence: 0.99,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(
      "android_find_template failed: best score 0.94 below confidence 0.99"
    );
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
        waitTimeoutMs: 1000,
        timeoutMs: 2500,
        pollMs: 50,
      })
    );
    expect(plugin.connect).toHaveBeenLastCalledWith({
      serial: "phone",
      adbPath: undefined,
      timeoutMs: 2500,
    });
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

    await tools.get("android_back")!({ serial: "phone" });
    await tools.get("android_home")!({ serial: "phone" });
    expect(plugin.device.back).toHaveBeenCalled();
    expect(plugin.device.home).toHaveBeenCalled();

    await tools.get("android_start_app")!({
      serial: "phone",
      packageName: "com.example",
      activity: ".MainActivity",
    });
    await tools.get("android_stop_app")!({
      serial: "phone",
      packageName: "com.example",
    });
    expect(plugin.device.startApp).toHaveBeenCalledWith("com.example", ".MainActivity");
    expect(plugin.device.stopApp).toHaveBeenCalledWith("com.example");

    json = parseToolJson(await tools.get("android_current_app")!({ serial: "phone" }));
    expect(plugin.device.currentApp).toHaveBeenCalled();
    expect(json.packageName).toBe("com.example");

    await tools.get("android_clear_app")!({
      serial: "phone",
      packageName: "com.example",
    });
    expect(plugin.device.clearApp).toHaveBeenCalledWith("com.example");
  });

  it("returns MCP errors when plugin calls fail", async () => {
    plugin.connect.mockRejectedValue(new Error("adb unavailable"));

    const result = await registerTools().get("android_tap")!({
      serial: "phone",
      x: 1,
      y: 2,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe("android_tap failed: adb unavailable");
  });
});
