import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  find: vi.fn(),
  findAll: vi.fn(),
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
  windowApi: {
    focus: vi.fn(),
    getActive: vi.fn(),
    list: vi.fn(),
  },
}));

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
        searchRegion: { left: 1, top: 2, width: 100, height: 80 },
      })
    );

    expect(core.find).toHaveBeenCalledWith("button.png", {
      confidence: 0.9,
      searchRegion: { left: 1, top: 2, width: 100, height: 80 },
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
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
      searchRegion: undefined,
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
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
      searchRegion: undefined,
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(json.coordinateSpace).toBe("screen");
    expect(json.matches).toHaveLength(2);
  });
});
