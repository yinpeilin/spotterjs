import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
}));

const artifacts = vi.hoisted(() => ({
  captureScreenArtifact: vi.fn(),
  captureWindowArtifact: vi.fn(),
  captureActiveArtifact: vi.fn(),
}));

vi.mock("@spotterjs/core", () => ({
  accessibility: {
    debug: {
      attachWindowReport: vi.fn(),
      dumpTree: vi.fn(),
      getElementInfo: vi.fn(),
    },
    quick: {
      click: vi.fn(),
      find: vi.fn(),
      invoke: vi.fn(),
    },
  },
  captureToBase64: vi.fn(() => ""),
  clipboard: {
    get: vi.fn(),
    set: vi.fn(),
  },
  desktop: {
    listApps: vi.fn(),
  },
  keyboard: {
    write: vi.fn(),
  },
  mouse: {
    click: vi.fn(),
    move: vi.fn(),
    tap: vi.fn(),
  },
  screen: {
    capture: vi.fn(() => ({ data: Buffer.alloc(0), width: 0, height: 0 })),
    captureActive: vi.fn(() => ({ data: Buffer.alloc(0), width: 0, height: 0 })),
    captureWindow: vi.fn(() => ({ data: Buffer.alloc(0), width: 0, height: 0 })),
    find: core.find,
    findAll: core.findAll,
  },
  windows: {
    active: vi.fn(),
    focus: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock("../adapters/capture.js", () => artifacts);

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
  core.find.mockReset();
  core.findAll.mockReset();
  artifacts.captureScreenArtifact.mockReset();
  artifacts.captureWindowArtifact.mockReset();
  artifacts.captureActiveArtifact.mockReset();
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
      },
      {
        region: { left: 30, top: 40, width: 10, height: 12 },
        center: { x: 35, y: 46 },
        score: 0.9,
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

  it("uses bounded schemas for regions and scale", () => {
    const schema = registerToolEntries().get("desktop_find_template")!.config.inputSchema;

    expect(() => schema.region.parse({ left: 0, top: 0, width: 0, height: 10 })).toThrow();
    expect(() => schema.confidence.parse(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => schema.scale._def.options[1].shape.step.parse(-0.1)).toThrow();
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
