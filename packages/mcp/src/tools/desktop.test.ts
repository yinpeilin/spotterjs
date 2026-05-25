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

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }> }>;

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };

  registerDesktopTools(server as never, false);
  return tools;
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
    });
    const handler = registerTools().get("desktop_capture_screen");
    expect(handler).toBeDefined();

    const result = await handler!({});
    const json = JSON.parse(result.content[0].text!);

    expect(json.format).toBe("png");
    expect(json.isDownscaled).toBe(true);
    expect(json.originalWidth).toBe(2400);
    expect(json.width).toBe(1600);
    expect(result.content).toHaveLength(1);
    expect(artifacts.captureScreenArtifact).toHaveBeenCalledWith(undefined);
  });
});
