import { beforeEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  pair: vi.fn(),
  connect: vi.fn(),
  device: {
    sessionToken: "token-1",
    url: "ws://phone:17341",
    heartbeat: vi.fn(),
    status: vi.fn(),
    getDisplayInfo: vi.fn(),
    currentApp: vi.fn(),
    dumpTree: vi.fn(),
    tap: vi.fn(),
    swipe: vi.fn(),
    gesture: vi.fn(),
    text: vi.fn(),
    keyevent: vi.fn(),
    back: vi.fn(),
    home: vi.fn(),
    launchApp: vi.fn(),
    captureScreen: vi.fn(),
    close: vi.fn(),
  },
}));

const core = vi.hoisted(() => ({
  decodedCapture: { data: Buffer.alloc(20 * 10 * 4), width: 20, height: 10 },
  imageDecode: vi.fn(),
  imageFind: vi.fn(),
  imageFindAll: vi.fn(),
}));

const artifacts = vi.hoisted(() => ({
  workspaceImageStore: {
    writeCapture: vi.fn(() => ({
      imagePath: ".spotter/artifacts/android-capture.png",
      width: 20,
      height: 10,
      originalWidth: 20,
      originalHeight: 10,
      format: "png",
      isDownscaled: false,
      detail: "original",
    })),
  },
}));

const debugDraw = vi.hoisted(() => ({
  writeDebugCapture: vi.fn(() => ({
    imagePath: ".spotter/artifacts/android-debug.png",
    width: 20,
    height: 10,
    originalWidth: 20,
    originalHeight: 10,
    format: "png",
    isDownscaled: false,
    detail: "original",
  })),
}));

vi.mock("@spotterjs/plugin-android", () => ({
  android: {
    pair: plugin.pair,
    connect: plugin.connect,
  },
}));

vi.mock("@spotterjs/core", () => ({
  image: {
    decode: core.imageDecode,
    find: core.imageFind,
    findAll: core.imageFindAll,
  },
}));

vi.mock("../adapters/artifacts.js", () => artifacts);
vi.mock("../adapters/debug-draw.js", () => debugDraw);

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
  plugin.pair.mockReset();
  plugin.connect.mockReset();
  for (const fn of Object.values(plugin.device)) {
    if (typeof fn === "function") fn.mockReset();
  }
  core.imageDecode.mockReset();
  core.imageFind.mockReset();
  core.imageFindAll.mockReset();
  artifacts.workspaceImageStore.writeCapture.mockClear();
  debugDraw.writeDebugCapture.mockClear();
  core.imageDecode.mockReturnValue(core.decodedCapture);
  plugin.pair.mockResolvedValue(plugin.device);
  plugin.connect.mockResolvedValue(plugin.device);
  plugin.device.status.mockResolvedValue({});
  plugin.device.captureScreen.mockResolvedValue({
    mimeType: "image/png",
    width: 20,
    height: 10,
    density: 420,
    bytes: Buffer.from("png bytes"),
  });
});

describe("android companion MCP tools", () => {
  it("pairs with the companion app and returns the session token", async () => {
    const json = parseToolJson(
      await registerTools().get("android_connect")!({
        url: "ws://phone:17341",
        code: "123456",
        clientId: "mcp-test",
        timeoutMs: 1000,
      })
    );

    expect(plugin.pair).toHaveBeenCalledWith({
      url: "ws://phone:17341",
      code: "123456",
      clientId: "mcp-test",
      timeoutMs: 1000,
    });
    expect(json).toEqual({
      deviceId: "default",
      url: "ws://phone:17341",
      sessionToken: "token-1",
    });
  });

  it("reuses an existing companion session token", async () => {
    const json = parseToolJson(
      await registerTools().get("android_connect")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
        timeoutMs: 1000,
      })
    );

    expect(plugin.connect).toHaveBeenCalledWith({
      url: "ws://phone:17341",
      sessionToken: "token-1",
      timeoutMs: 1000,
    });
    expect(plugin.pair).not.toHaveBeenCalled();
    expect(json).toEqual({
      deviceId: "default",
      url: "ws://phone:17341",
      sessionToken: "token-1",
    });
  });

  it("caches connected devices by deviceId for later tool calls", async () => {
    plugin.device.status.mockResolvedValue({ running: true });
    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_connect")!({
        deviceId: "phone",
        url: "ws://phone:17341",
        code: "123456",
      })
    );
    expect(json).toEqual({
      deviceId: "phone",
      url: "ws://phone:17341",
      sessionToken: "token-1",
    });

    json = parseToolJson(await tools.get("android_status")!({ deviceId: "phone" }));

    expect(plugin.pair).toHaveBeenCalledTimes(1);
    expect(plugin.connect).not.toHaveBeenCalled();
    expect(plugin.device.status).toHaveBeenCalled();
    expect(json).toEqual({ running: true });
  });

  it("disconnects cached devices", async () => {
    const tools = registerTools();

    await tools.get("android_connect")!({
      deviceId: "phone",
      url: "ws://phone:17341",
      code: "123456",
    });
    const result = await tools.get("android_disconnect")!({ deviceId: "phone" });

    expect(plugin.device.close).toHaveBeenCalled();
    expect(result.content[0]?.text).toBe("ok");
  });

  it("lists cached Android devices with identity captured at connect time", async () => {
    const phoneA = {
      ...plugin.device,
      sessionToken: "token-a",
      url: "ws://phone-a:17341",
      status: vi.fn().mockResolvedValue({
        manufacturer: "Google",
        model: "Pixel 8",
        nickname: "lab-1",
      }),
      close: vi.fn(),
    };
    const phoneB = {
      ...plugin.device,
      sessionToken: "token-b",
      url: "ws://phone-b:17341",
      status: vi.fn().mockResolvedValue({
        manufacturer: "Samsung",
        model: "SM-S921U",
        nickname: "lab-2",
      }),
      close: vi.fn(),
    };
    plugin.pair.mockResolvedValueOnce(phoneA).mockResolvedValueOnce(phoneB);
    const tools = registerTools();

    await tools.get("android_connect")!({
      deviceId: "a",
      url: "ws://phone-a:17341",
      code: "111111",
    });
    await tools.get("android_connect")!({
      deviceId: "b",
      url: "ws://phone-b:17341",
      code: "222222",
    });

    const json = parseToolJson(await tools.get("android_list_devices")!({}));

    expect(json.devices).toEqual([
      {
        deviceId: "a",
        url: "ws://phone-a:17341",
        manufacturer: "Google",
        model: "Pixel 8",
        nickname: "lab-1",
      },
      {
        deviceId: "b",
        url: "ws://phone-b:17341",
        manufacturer: "Samsung",
        model: "SM-S921U",
        nickname: "lab-2",
      },
    ]);
  });

  it("omits Android device identity fields missing from old companions", async () => {
    plugin.device.status.mockResolvedValue({ running: true });
    const tools = registerTools();

    await tools.get("android_connect")!({
      deviceId: "legacy",
      url: "ws://phone:17341",
      code: "123456",
    });

    expect(parseToolJson(await tools.get("android_list_devices")!({}))).toEqual({
      devices: [
        {
          deviceId: "legacy",
          url: "ws://phone:17341",
        },
      ],
    });
  });

  it("keeps connected Android devices listable when identity status fails", async () => {
    plugin.device.status.mockRejectedValue(new Error("status unavailable"));
    const tools = registerTools();

    const connected = parseToolJson(
      await tools.get("android_connect")!({
        deviceId: "phone",
        url: "ws://phone:17341",
        code: "123456",
      })
    );
    const listed = parseToolJson(await tools.get("android_list_devices")!({}));

    expect(connected).toEqual({
      deviceId: "phone",
      url: "ws://phone:17341",
      sessionToken: "token-1",
    });
    expect(listed).toEqual({
      devices: [
        {
          deviceId: "phone",
          url: "ws://phone:17341",
        },
      ],
    });
  });

  it("uses the session token for status and heartbeat", async () => {
    plugin.device.status.mockResolvedValue({ running: true });
    const tools = registerTools();

    let json = parseToolJson(
      await tools.get("android_status")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
      })
    );
    expect(plugin.connect).toHaveBeenCalledWith({
      url: "ws://phone:17341",
      sessionToken: "token-1",
      timeoutMs: undefined,
    });
    expect(json).toEqual({ running: true });

    const result = await tools.get("android_heartbeat")!({
      url: "ws://phone:17341",
      sessionToken: "token-1",
    });
    expect(plugin.device.heartbeat).toHaveBeenCalled();
    expect(result.content[0]?.text).toBe("ok");
  });

  it("runs input and device info commands through the companion session", async () => {
    plugin.device.getDisplayInfo.mockResolvedValue({
      width: 1080,
      height: 2400,
      density: 420,
    });
    plugin.device.currentApp.mockResolvedValue({
      packageName: "com.example",
    });

    const tools = registerTools();
    const session = { url: "ws://phone:17341", sessionToken: "token-1" };

    await tools.get("android_tap")!({ ...session, x: 10, y: 20 });
    await tools.get("android_swipe")!({
      ...session,
      from: { x: 1, y: 2 },
      to: { x: 3, y: 4 },
      durationMs: 200,
    });
    await tools.get("android_gesture")!({
      ...session,
      strokes: [
        {
          points: [
            { x: 10, y: 20 },
            { x: 12, y: 22 },
          ],
          durationMs: 250,
          startDelayMs: 5,
        },
      ],
    });
    await tools.get("android_text")!({ ...session, text: "hello" });
    await tools.get("android_keyevent")!({ ...session, key: "BACK" });
    await tools.get("android_back")!(session);
    await tools.get("android_home")!(session);

    expect(plugin.device.tap).toHaveBeenCalledWith(10, 20);
    expect(plugin.device.swipe).toHaveBeenCalledWith(
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { durationMs: 200 }
    );
    expect(plugin.device.gesture).toHaveBeenCalledWith([
      {
        points: [
          { x: 10, y: 20 },
          { x: 12, y: 22 },
        ],
        durationMs: 250,
        startDelayMs: 5,
      },
    ]);
    expect(plugin.device.text).toHaveBeenCalledWith("hello");
    expect(plugin.device.keyevent).toHaveBeenCalledWith("BACK");
    expect(plugin.device.back).toHaveBeenCalled();
    expect(plugin.device.home).toHaveBeenCalled();

    let json = parseToolJson(await tools.get("android_display_info")!(session));
    expect(json.width).toBe(1080);

    json = parseToolJson(await tools.get("android_current_app")!(session));
    expect(json.packageName).toBe("com.example");
  });

  it("launches apps through the companion session", async () => {
    plugin.device.launchApp.mockResolvedValue({
      packageName: "com.android.settings",
      activity: "com.android.settings.Settings",
    });

    const json = parseToolJson(
      await registerTools().get("android_launch_app")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
        packageName: "com.android.settings",
      })
    );

    expect(plugin.device.launchApp).toHaveBeenCalledWith("com.android.settings");
    expect(json).toEqual({
      packageName: "com.android.settings",
      activity: "com.android.settings.Settings",
    });
  });

  it("dumps and queries accessibility tree nodes", async () => {
    const element = {
      text: "Search",
      resourceId: "com.example:id/search",
      className: "android.widget.EditText",
      packageName: "com.example",
      contentDescription: "",
      clickable: true,
      enabled: true,
      checked: false,
      selected: false,
      scrollable: false,
      focusable: true,
      bounds: { left: 20, top: 30, width: 200, height: 60 },
      center: { x: 120, y: 60 },
      children: [],
      depth: 1,
      path: "0.0",
    };
    plugin.device.dumpTree.mockResolvedValue({
      ...element,
      text: "",
      resourceId: "",
      children: [element],
      depth: 0,
      path: "0",
    });

    const tools = registerTools();
    const session = { url: "ws://phone:17341", sessionToken: "token-1" };

    let json = parseToolJson(
      await tools.get("android_dump_tree")!({ ...session, maxDepth: 4 })
    );
    expect(plugin.device.dumpTree).toHaveBeenCalledWith({ maxDepth: 4 });
    expect(json.coordinateSpace).toBe("android-device");

    json = parseToolJson(
      await tools.get("android_find_element")!({
        ...session,
        resourceIdContains: "search",
      })
    );
    expect(json.element.text).toBe("Search");

    json = parseToolJson(
      await tools.get("android_tap_element")!({
        ...session,
        text: "Search",
      })
    );
    expect(plugin.device.tap).toHaveBeenCalledWith(120, 60);
    expect(json.element.resourceId).toBe("com.example:id/search");

    json = parseToolJson(
      await tools.get("android_type_element")!({
        ...session,
        text: "Search",
        textToType: "hello",
      })
    );
    expect(plugin.device.text).toHaveBeenCalledWith("hello");
    expect(json.element.text).toBe("Search");
  });

  it("waits for elements with poll interval and max depth", async () => {
    const element = {
      text: "Settings",
      resourceId: "android:id/title",
      className: "android.widget.TextView",
      packageName: "com.android.settings",
      contentDescription: "",
      clickable: true,
      enabled: true,
      checked: false,
      selected: false,
      scrollable: false,
      focusable: true,
      bounds: { left: 20, top: 30, width: 200, height: 60 },
      center: { x: 120, y: 60 },
      children: [],
      depth: 1,
      path: "0.0",
    };
    plugin.device.dumpTree
      .mockResolvedValueOnce({ ...element, text: "", children: [], depth: 0, path: "0" })
      .mockResolvedValueOnce({ ...element, text: "", children: [element], depth: 0, path: "0" });

    const json = parseToolJson(
      await registerTools().get("android_wait_for_element")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
        text: "Settings",
        waitTimeoutMs: 100,
        pollMs: 0,
        maxDepth: 5,
      })
    );

    expect(plugin.device.dumpTree).toHaveBeenNthCalledWith(1, { maxDepth: 5 });
    expect(plugin.device.dumpTree).toHaveBeenNthCalledWith(2, { maxDepth: 5 });
    expect(json.element.text).toBe("Settings");
  });

  it("captures Android screens as workspace artifacts", async () => {
    const json = parseToolJson(await registerTools().get("android_capture_screen")!({
      url: "ws://phone:17341",
      sessionToken: "token-1",
      detail: "high",
    }));

    expect(plugin.device.captureScreen).toHaveBeenCalled();
    expect(core.imageDecode).toHaveBeenCalledWith(Buffer.from("png bytes"));
    expect(artifacts.workspaceImageStore.writeCapture).toHaveBeenCalledWith(
      core.decodedCapture,
      { prefix: "android-screen", detail: "high" }
    );
    expect(json).toMatchObject({
      imagePath: ".spotter/artifacts/android-capture.png",
      origin: { x: 0, y: 0 },
      coordinateSpace: "android-device",
      density: 420,
    });
  });

  it("finds Android templates on a captured screen artifact", async () => {
    const template = Buffer.from("template bytes");
    core.imageFindAll.mockResolvedValue([
      {
        region: { left: 2, top: 3, width: 4, height: 5 },
        center: { x: 4, y: 5 },
        score: 0.91,
        matchScore: 0.91,
        matchAlgorithm: "ncc",
      },
    ]);

    const json = parseToolJson(
      await registerTools().get("android_find_template")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
        image: { base64: template.toString("base64"), mimeType: "image/png" },
        confidence: 0.9,
        region: { left: 1, top: 2, width: 10, height: 8 },
        scale: true,
        all: true,
        debugImage: true,
      })
    );

    expect(core.imageFindAll).toHaveBeenCalledWith(core.decodedCapture, template, {
      confidence: 0.9,
      region: { left: 1, top: 2, width: 10, height: 8 },
      scale: true,
    });
    expect(json).toMatchObject({
      coordinateSpace: "android-device",
      matches: [
        {
          region: { left: 2, top: 3, width: 4, height: 5 },
          center: { x: 4, y: 5 },
        },
      ],
      debugImagePath: ".spotter/artifacts/android-debug.png",
    });
  });

  it("taps only after Android template matching succeeds", async () => {
    core.imageFind.mockResolvedValue({
      region: { left: 2, top: 3, width: 4, height: 5 },
      center: { x: 4, y: 5 },
      score: 0.91,
      matchScore: 0.91,
      matchAlgorithm: "ncc",
    });

    const json = parseToolJson(
      await registerTools().get("android_find_template_and_tap")!({
        url: "ws://phone:17341",
        sessionToken: "token-1",
        image: { path: "button.png" },
      })
    );

    expect(core.imageFind).toHaveBeenCalledWith(core.decodedCapture, "button.png", {
      confidence: undefined,
      region: undefined,
      scale: undefined,
    });
    expect(plugin.device.tap).toHaveBeenCalledWith(4, 5);
    expect(json).toMatchObject({
      coordinateSpace: "android-device",
      tapPoint: { x: 4, y: 5 },
      match: { center: { x: 4, y: 5 } },
    });

    core.imageFind.mockRejectedValueOnce(new Error("no match"));
    const failed = await registerTools().get("android_find_template_and_tap")!({
      url: "ws://phone:17341",
      sessionToken: "token-1",
      image: { path: "missing.png" },
    });

    expect(failed.isError).toBe(true);
    expect(plugin.device.tap).toHaveBeenCalledTimes(1);
  });

  it("uses bounded numeric schemas for coordinates and timeouts", () => {
    const tools = registerToolEntries();
    const tapSchema = tools.get("android_tap")!.config.inputSchema;
    const waitSchema = tools.get("android_wait_for_element")!.config.inputSchema;

    expect(() => tapSchema.x.parse(Number.NaN)).toThrow();
    expect(() => tapSchema.x.parse(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => waitSchema.waitTimeoutMs.parse(-1)).toThrow();
  });
});
