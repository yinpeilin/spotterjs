import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
  imageFind: vi.fn(),
  imageFindAll: vi.fn(),
}));

const artifacts = vi.hoisted(() => ({
  captureScreenArtifact: vi.fn(),
  captureWindowArtifact: vi.fn(),
  captureActiveArtifact: vi.fn(),
}));

const debugDraw = vi.hoisted(() => {
  const z = require("zod");
  return {
    debugImageField: { debugImage: z.boolean().optional() },
    debugImagePatch: vi.fn((enabled: boolean | undefined, write: () => { imagePath: string }) =>
      enabled ? { debugImagePath: write().imagePath } : {}
    ),
    matchAnnotations: vi.fn((matches: Array<{ region: unknown; center: unknown }>) =>
      matches.flatMap((m) => [
        { kind: "region", region: m.region },
        { kind: "point", point: m.center },
      ])
    ),
    writeDebugCapture: vi.fn(() => ({
      imagePath: ".spotter/artifacts/desktop-debug.png",
      width: 100,
      height: 80,
      originalWidth: 100,
      originalHeight: 80,
      format: "png",
      isDownscaled: false,
      detail: "original",
    })),
  };
});

vi.mock("@spotterjs/core", () => ({
  accessibility: {
    debug: {
      attachWindowReport: vi.fn(),
      dumpTree: vi.fn(),
      getElementInfo: vi.fn(),
    },
    click: vi.fn(),
    find: vi.fn(),
    invoke: vi.fn(),
  },
  clipboard: {
    get: vi.fn(),
    set: vi.fn(),
  },
  desktop: {
    listApps: vi.fn(),
  },
  keyboard: {
    tap: vi.fn(),
    write: vi.fn(),
  },
  mouse: {
    click: vi.fn(),
    getPosition: vi.fn(() => ({ x: 44, y: 55 })),
    move: vi.fn(),
    tap: vi.fn(),
  },
  screen: {
    capture: vi.fn(() => ({ data: Buffer.alloc(100 * 80 * 4), width: 100, height: 80 })),
    captureActive: vi.fn(() => ({ data: Buffer.alloc(0), width: 0, height: 0 })),
    captureWindow: vi.fn(() => ({ data: Buffer.alloc(0), width: 0, height: 0 })),
    findTemplate: core.find,
    findAllTemplates: core.findAll,
  },
  windows: {
    getActive: vi.fn(),
    focus: vi.fn(),
    list: vi.fn(),
  },
  image: {
    findTemplate: core.imageFind,
    findAllTemplates: core.imageFindAll,
  },
}));

vi.mock("../adapters/capture.js", () => artifacts);
vi.mock("../adapters/debug-draw.js", () => debugDraw);

import { registerDesktopTools } from "./desktop.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;
type RegisteredTool = { config: any; handler: ToolHandler };

function registerToolEntries(a11yEnabled = false): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, config: unknown, handler: ToolHandler) {
      tools.set(name, { config, handler });
    },
  };

  registerDesktopTools(server as never, a11yEnabled);
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
  vi.clearAllMocks();
  core.find.mockReset();
  core.findAll.mockReset();
  core.imageFind.mockReset();
  core.imageFindAll.mockReset();
  artifacts.captureScreenArtifact.mockReset();
  artifacts.captureWindowArtifact.mockReset();
  artifacts.captureActiveArtifact.mockReset();
  debugDraw.writeDebugCapture.mockClear();
});

describe("desktop MCP error handling", () => {
  it("returns MCP errors when desktop operations throw", async () => {
    const { windows } = await import("@spotterjs/core");
    vi.mocked(windows.focus).mockImplementation(() => {
      throw new Error("window not found");
    });

    const result = await registerTools().get("desktop_focus_window")!({
      windowId: "missing",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(
      "desktop_focus_window failed: window not found"
    );
  });
});

describe("desktop_find_template", () => {
  it("accepts image.path and returns screen-space matches", async () => {
    core.find.mockResolvedValue({
      region: { left: 10, top: 20, width: 6, height: 8 },
      center: { x: 13, y: 24 },
      score: 0.94,
      matchScore: 0.94,
      matchAlgorithm: "ncc",
    });

    const handler = registerTools().get("desktop_find_template");
    expect(handler).toBeDefined();

    const json = parseToolJson(
      await handler!({
        image: { path: "button.png" },
        confidence: 0.9,
        region: { left: 1, top: 2, width: 100, height: 80 },
      })
    );

    expect(core.find).toHaveBeenCalledWith("button.png", {
      confidence: 0.9,
      region: { left: 1, top: 2, width: 100, height: 80 },
      scale: undefined,
    });
    expect(json).toEqual({
      matches: [
        {
          region: { left: 10, top: 20, width: 6, height: 8 },
          center: { x: 13, y: 24 },
          score: 0.94,
          matchScore: 0.94,
          matchAlgorithm: "ncc",
        },
      ],
      coordinateSpace: "screen",
    });
  });

  it("accepts image.base64 encoded bytes", async () => {
    core.find.mockResolvedValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      center: { x: 2, y: 4 },
      score: 0.91,
      matchScore: 0.91,
      matchAlgorithm: "ncc",
    });

    const handler = registerTools().get("desktop_find_template");
    const bytes = Buffer.from("encoded image bytes");

    await handler!({
      image: { base64: bytes.toString("base64"), mimeType: "image/png" },
    });

    expect(core.find).toHaveBeenCalledWith(bytes, {
      confidence: undefined,
      region: undefined,
      scale: undefined,
    });
  });

  it("returns multiple matches when all is true", async () => {
    core.findAll.mockResolvedValue([
      {
        region: { left: 10, top: 20, width: 6, height: 8 },
        center: { x: 13, y: 24 },
        score: 0.94,
        matchScore: 0.94,
        matchAlgorithm: "ncc",
      },
      {
        region: { left: 30, top: 40, width: 10, height: 12 },
        center: { x: 35, y: 46 },
        score: 0.9,
        matchScore: 0.9,
        matchAlgorithm: "ncc",
      },
    ]);

    const handler = registerTools().get("desktop_find_template");
    const json = parseToolJson(
      await handler!({
        image: { path: "button.png" },
        all: true,
      })
    );

    expect(core.findAll).toHaveBeenCalledWith("button.png", {
      confidence: undefined,
      region: undefined,
      scale: undefined,
    });
    expect(json.coordinateSpace).toBe("screen");
    expect(json.matches).toHaveLength(2);
  });

  it("captures once and returns a debug image for template matching", async () => {
    const { screen } = await import("@spotterjs/core");
    const capture = { data: Buffer.alloc(100 * 80 * 4), width: 100, height: 80 };
    vi.mocked(screen.capture).mockReturnValue(capture);
    core.imageFind.mockResolvedValue({
      region: { left: 9, top: 18, width: 6, height: 8 },
      center: { x: 12, y: 22 },
      score: 0.93,
      matchScore: 0.93,
      matchAlgorithm: "ncc",
    });

    const json = parseToolJson(
      await registerTools().get("desktop_find_template")!({
        image: { path: "button.png" },
        confidence: 0.9,
        region: { left: 1, top: 2, width: 100, height: 80 },
        debugImage: true,
      })
    );

    expect(screen.capture).toHaveBeenCalledWith({
      left: 1,
      top: 2,
      width: 100,
      height: 80,
    });
    expect(core.imageFind).toHaveBeenCalledWith(capture, "button.png", {
      confidence: 0.9,
      region: undefined,
      scale: undefined,
    });
    expect(core.find).not.toHaveBeenCalled();
    expect(json.matches[0]).toMatchObject({
      region: { left: 10, top: 20, width: 6, height: 8 },
      center: { x: 13, y: 24 },
      score: 0.93,
      matchScore: 0.93,
      matchAlgorithm: "ncc",
    });
    expect(json.debugImagePath).toBe(".spotter/artifacts/desktop-debug.png");
    expect(debugDraw.writeDebugCapture).toHaveBeenCalledWith(
      capture,
      expect.arrayContaining([
        expect.objectContaining({ kind: "region" }),
        expect.objectContaining({ kind: "point" }),
      ]),
      { prefix: "desktop-find-template-debug" }
    );
  });

  it("uses bounded schemas for regions and scale", () => {
    const schema = registerToolEntries().get("desktop_find_template")!.config.inputSchema;

    expect(() => schema.region.parse({ left: 0, top: 0, width: 0, height: 10 })).toThrow();
    expect(() => schema.confidence.parse(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => schema.scale._def.options[1].shape.step.parse(-0.1)).toThrow();
    expect(schema.debugImage.parse(true)).toBe(true);
  });
});

describe("desktop debug input tools", () => {
  it("marks the intended mouse tap point when debug images are requested", async () => {
    const { mouse, screen } = await import("@spotterjs/core");
    const capture = { data: Buffer.alloc(100 * 80 * 4), width: 100, height: 80 };
    vi.mocked(screen.capture).mockReturnValue(capture);

    const json = parseToolJson(
      await registerTools().get("desktop_mouse_tap")!({
        x: 10,
        y: 20,
        debugImage: true,
      })
    );

    expect(screen.capture).toHaveBeenCalledWith();
    expect(mouse.tap).toHaveBeenCalledWith(10, 20, undefined);
    expect(json).toMatchObject({
      status: "ok",
      tapPoint: { x: 10, y: 20 },
      coordinateSpace: "screen",
      debugImagePath: ".spotter/artifacts/desktop-debug.png",
    });
  });

  it("marks the current cursor point for mouse click debug images", async () => {
    const { mouse } = await import("@spotterjs/core");

    const json = parseToolJson(
      await registerTools().get("desktop_mouse_click")!({
        button: "right",
        debugImage: true,
      })
    );

    expect(mouse.getPosition).toHaveBeenCalled();
    expect(mouse.click).toHaveBeenCalledWith("right");
    expect(json.tapPoint).toEqual({ x: 44, y: 55 });
    expect(json.debugImagePath).toBe(".spotter/artifacts/desktop-debug.png");
  });

  it("marks accessibility tap bounds and center when debug images are requested", async () => {
    const { accessibility } = await import("@spotterjs/core");
    vi.mocked(accessibility.click).mockReturnValue({
      left: 20,
      top: 30,
      width: 40,
      height: 20,
    });

    const json = parseToolJson(
      await registerToolEntries(true).get("desktop_a11y_tap_element")!.handler({
        elementId: "element-1",
        debugImage: true,
      })
    );

    expect(accessibility.click).toHaveBeenCalledWith("element-1");
    expect(json).toMatchObject({
      region: { left: 20, top: 30, width: 40, height: 20 },
      tapPoint: { x: 40, y: 40 },
      coordinateSpace: "screen",
      debugImagePath: ".spotter/artifacts/desktop-debug.png",
    });
  });
});

describe("desktop_capture_screen", () => {
  it("returns a workspace artifact instead of inline image content", async () => {
    artifacts.captureScreenArtifact.mockReturnValue({
      imagePath: ".spotter/artifacts/desktop-screen.png",
      width: 1600,
      height: 800,
      originalWidth: 2400,
      originalHeight: 1200,
      format: "png",
      isDownscaled: true,
      detail: "high",
    });
    const handler = registerTools().get("desktop_capture_screen");
    expect(handler).toBeDefined();

    const result = await handler!({});
    const json = JSON.parse(result.content[0].text!);

    expect(json.format).toBe("png");
    expect(json.isDownscaled).toBe(true);
    expect(json.detail).toBe("high");
    expect(json.originalWidth).toBe(2400);
    expect(json.width).toBe(1600);
    expect(result.content).toHaveLength(1);
    expect(artifacts.captureScreenArtifact).toHaveBeenCalledWith(undefined, {
      detail: undefined,
    });
  });

  it("captures a region, a specific window, and the active window as artifacts", async () => {
    const artifact = {
      imagePath: ".spotter/artifacts/cap.png",
      width: 10,
      height: 5,
      originalWidth: 10,
      originalHeight: 5,
      format: "png",
      isDownscaled: false,
      detail: "high",
    };
    artifacts.captureScreenArtifact.mockReturnValue(artifact);
    artifacts.captureWindowArtifact.mockReturnValue({ ...artifact, windowId: "win-1" });
    artifacts.captureActiveArtifact.mockReturnValue(artifact);
    const tools = registerTools();
    const region = { left: 1, top: 2, width: 3, height: 4 };

    let json = parseToolJson(await tools.get("desktop_capture_screen")!({
      region,
      detail: "original",
    }));
    expect(artifacts.captureScreenArtifact).toHaveBeenCalledWith(region, {
      detail: "original",
    });
    expect(json.imagePath).toBe(".spotter/artifacts/cap.png");

    json = parseToolJson(await tools.get("desktop_capture_window")!({
      windowId: "win-1",
      detail: "original",
    }));
    expect(artifacts.captureWindowArtifact).toHaveBeenCalledWith("win-1", {
      detail: "original",
    });
    expect(json.windowId).toBe("win-1");

    json = parseToolJson(await tools.get("desktop_capture_active")!({
      detail: "original",
    }));
    expect(artifacts.captureActiveArtifact).toHaveBeenCalledWith({
      detail: "original",
    });
    expect(json.format).toBe("png");
  });

  it("uses bounded schemas for capture and accessibility arguments", () => {
    const tools = registerToolEntries(true);
    const captureSchema = tools.get("desktop_capture_screen")!.config.inputSchema;
    const captureWindowSchema = tools.get("desktop_capture_window")!.config.inputSchema;
    const captureActiveSchema = tools.get("desktop_capture_active")!.config.inputSchema;
    const mouseSchema = tools.get("desktop_mouse_move")!.config.inputSchema;
    const dumpSchema = tools.get("desktop_a11y_dump_tree")!.config.inputSchema;

    expect(() =>
      captureSchema.region.parse({ left: 0, top: 0, width: 0, height: 1 })
    ).toThrow();
    expect(captureSchema.detail.parse("high")).toBe("high");
    expect(captureWindowSchema.detail.parse("original")).toBe("original");
    expect(captureActiveSchema.detail.parse("high")).toBe("high");
    expect(() => captureSchema.detail.parse("low")).toThrow();
    expect(() => mouseSchema.x.parse(Number.NaN)).toThrow();
    expect(() => dumpSchema.maxDepth.parse(101)).toThrow();
  });
});

describe("desktop keyboard tools", () => {
  it("passes text typing options through to core keyboard.write", async () => {
    const { keyboard } = await import("@spotterjs/core");
    const handler = registerTools().get("desktop_keyboard_type");

    await handler!({
      text: "hello",
      autoDelayMs: 30,
      mode: "native",
      restoreClipboard: false,
    });

    expect(keyboard.write).toHaveBeenCalledWith("hello", {
      autoDelayMs: 30,
      mode: "native",
      restoreClipboard: false,
    });
  });

  it("registers desktop_keyboard_tap for named and numeric keys", async () => {
    const { keyboard } = await import("@spotterjs/core");
    const handler = registerTools().get("desktop_keyboard_tap");

    await handler!({ key: "Enter", autoDelayMs: 10 });
    await handler!({ key: "1" });
    await handler!({ key: 1 });

    expect(keyboard.tap).toHaveBeenNthCalledWith(1, "Enter", { autoDelayMs: 10 });
    expect(keyboard.tap).toHaveBeenNthCalledWith(2, "1", { autoDelayMs: undefined });
    expect(keyboard.tap).toHaveBeenNthCalledWith(3, 1, { autoDelayMs: undefined });
  });

  it("rejects out-of-range numeric key schema values", () => {
    const schema = registerToolEntries().get("desktop_keyboard_tap")!.config.inputSchema;

    expect(() => schema.shape.key.parse(10)).toThrow();
    expect(schema.shape.key.parse(0)).toBe(0);
    expect(schema.shape.key.parse("Enter")).toBe("Enter");
  });
});
