import { beforeEach, describe, expect, it, vi } from "vitest";

const core = vi.hoisted(() => ({
  imageFind: vi.fn(),
  imageFindAll: vi.fn(),
}));

const capture = vi.hoisted(() => ({
  screen: { data: Buffer.alloc(100 * 80 * 4), width: 100, height: 80 },
  window: { data: Buffer.alloc(120 * 90 * 4), width: 120, height: 90 },
}));

const artifacts = vi.hoisted(() => ({
  workspaceImageStore: {
    writeCapture: vi.fn(() => ({
      imagePath: ".spotter/artifacts/visual-capture.png",
      width: 100,
      height: 80,
      originalWidth: 100,
      originalHeight: 80,
      format: "png",
      isDownscaled: false,
      detail: "original",
    })),
  },
}));

const debugDraw = vi.hoisted(() => ({
  writeDebugCapture: vi.fn(() => ({
    imagePath: ".spotter/artifacts/visual-debug.png",
    width: 100,
    height: 80,
    originalWidth: 100,
    originalHeight: 80,
    format: "png",
    isDownscaled: false,
    detail: "original",
  })),
}));

const ocr = vi.hoisted(() => ({
  read: vi.fn(),
  findAllText: vi.fn(),
}));

const plugin = vi.hoisted(() => ({
  createOcr: vi.fn(),
  scoreOcrText: vi.fn((actual: string, expected: string) => ({
    query: expected,
    matched: actual === expected,
    matchAlgorithm: "ocr-text",
    matchKind: actual === expected ? "exact" : "none",
    matchScore: actual === expected ? 1 : 0,
  })),
}));

vi.mock("@spotterjs/core", () => ({
  image: {
    find: core.imageFind,
    findAll: core.imageFindAll,
  },
  mouse: {
    tap: vi.fn(),
  },
  screen: {
    capture: vi.fn(() => capture.screen),
    captureWindow: vi.fn(() => capture.window),
  },
  windows: {
    active: vi.fn(() => ({
      id: "active-1",
      region: { left: 30, top: 40, width: 120, height: 90 },
    })),
    region: vi.fn(() => ({ left: 100, top: 200, width: 120, height: 90 })),
  },
}));

vi.mock("@spotterjs/plugin-ocr", () => ({
  createOcr: plugin.createOcr,
  scoreOcrText: plugin.scoreOcrText,
}));

vi.mock("../adapters/artifacts.js", () => artifacts);
vi.mock("../adapters/debug-draw.js", () => debugDraw);

import { mouse, screen, windows } from "@spotterjs/core";
import { registerVisualTools } from "./visual.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;
type RegisteredTool = { config: any; handler: ToolHandler };

function registerToolEntries(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, config: unknown, handler: ToolHandler) {
      tools.set(name, { config, handler });
    },
  };

  registerVisualTools(server as never);
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
  core.imageFind.mockReset();
  core.imageFindAll.mockReset();
  ocr.read.mockReset();
  ocr.findAllText.mockReset();
  plugin.createOcr.mockReset();
  plugin.scoreOcrText.mockClear();
  plugin.createOcr.mockResolvedValue(ocr);
  artifacts.workspaceImageStore.writeCapture.mockReturnValue({
    imagePath: ".spotter/artifacts/visual-capture.png",
    width: 100,
    height: 80,
    originalWidth: 100,
    originalHeight: 80,
    format: "png",
    isDownscaled: false,
    detail: "original",
  });
});

describe("desktop_capture_and_ocr", () => {
  it("captures a screen region once, writes an original artifact, and reuses OCR clients", async () => {
    ocr.read.mockResolvedValue([
      {
        text: "Ready",
        score: 0.93,
        region: { left: 12, top: 25, width: 60, height: 16 },
        box: [
          { x: 12, y: 25 },
          { x: 72, y: 25 },
          { x: 72, y: 41 },
          { x: 12, y: 41 },
        ],
        center: { x: 42, y: 33 },
      },
    ]);

    const tools = registerTools();
    const region = { left: 10, top: 20, width: 100, height: 80 };
    const first = parseToolJson(
      await tools.get("desktop_capture_and_ocr")!({
        region,
        modelProfile: "server",
      })
    );
    await tools.get("desktop_capture_and_ocr")!({
      region,
      modelProfile: "server",
    });

    expect(screen.capture).toHaveBeenCalledTimes(2);
    expect(screen.capture).toHaveBeenCalledWith(region);
    expect(artifacts.workspaceImageStore.writeCapture).toHaveBeenCalledWith(
      capture.screen,
      { prefix: "desktop-capture-ocr", detail: "original" }
    );
    expect(plugin.createOcr).toHaveBeenCalledTimes(1);
    expect(ocr.read).toHaveBeenCalledWith(capture.screen, {
      searchRegion: undefined,
      origin: { x: 10, y: 20 },
    });
    expect(first).toMatchObject({
      imagePath: ".spotter/artifacts/visual-capture.png",
      source: "screen",
      origin: { x: 10, y: 20 },
      coordinateSpace: "screen",
      lines: [{ text: "Ready" }],
    });
  });

  it("returns scored OCR matches and a debug image from an active-window capture", async () => {
    ocr.read.mockResolvedValue([
      {
        text: "Send",
        score: 0.95,
        region: { left: 40, top: 50, width: 40, height: 16 },
        box: [
          { x: 40, y: 50 },
          { x: 80, y: 50 },
          { x: 80, y: 66 },
          { x: 40, y: 66 },
        ],
        center: { x: 60, y: 58 },
      },
      {
        text: "Save",
        score: 0.9,
        region: { left: 85, top: 50, width: 40, height: 16 },
        box: [
          { x: 85, y: 50 },
          { x: 125, y: 50 },
          { x: 125, y: 66 },
          { x: 85, y: 66 },
        ],
        center: { x: 105, y: 58 },
      },
    ]);

    const json = parseToolJson(
      await registerTools().get("desktop_capture_and_ocr")!({
        source: "active",
        text: "Send",
        exact: true,
        debugImage: true,
      })
    );

    expect(windows.active).toHaveBeenCalledTimes(1);
    expect(screen.captureWindow).toHaveBeenCalledWith("active-1");
    expect(ocr.findAllText).not.toHaveBeenCalled();
    expect(plugin.scoreOcrText).toHaveBeenCalledTimes(2);
    expect(json.matches).toHaveLength(1);
    expect(json.candidates).toHaveLength(2);
    expect(json.debugImagePath).toBe(".spotter/artifacts/visual-debug.png");
    expect(debugDraw.writeDebugCapture).toHaveBeenCalledWith(
      capture.window,
      expect.arrayContaining([
        expect.objectContaining({ kind: "polygon" }),
        expect.objectContaining({ kind: "point" }),
      ]),
      { prefix: "desktop-capture-ocr-debug" }
    );
  });

  it("treats an empty OCR query as an explicit text search", async () => {
    ocr.read.mockResolvedValue([
      {
        text: "",
        score: 0.8,
        region: { left: 10, top: 20, width: 1, height: 1 },
        box: [
          { x: 10, y: 20 },
          { x: 11, y: 20 },
          { x: 11, y: 21 },
          { x: 10, y: 21 },
        ],
        center: { x: 10, y: 20 },
      },
    ]);

    const json = parseToolJson(
      await registerTools().get("desktop_capture_and_ocr")!({
        text: "",
        exact: true,
      })
    );

    expect(json.lines).toBeUndefined();
    expect(json.matches).toHaveLength(1);
    expect(plugin.scoreOcrText).toHaveBeenCalledWith("", "", {
      exact: true,
      caseSensitive: undefined,
      minSimilarity: undefined,
    });
  });
});

describe("desktop_capture_and_find_template", () => {
  it("captures a window once, writes an artifact, translates matches, and marks debug images", async () => {
    core.imageFindAll.mockResolvedValue([
      {
        region: { left: 5, top: 7, width: 20, height: 10 },
        center: { x: 15, y: 12 },
        score: 0.94,
        matchScore: 0.94,
        matchAlgorithm: "ncc",
      },
    ]);
    artifacts.workspaceImageStore.writeCapture.mockReturnValue({
      imagePath: ".spotter/artifacts/window-capture.png",
      width: 60,
      height: 45,
      originalWidth: 120,
      originalHeight: 90,
      format: "png",
      isDownscaled: true,
      detail: "high",
    });
    const bytes = Buffer.from("template bytes");

    const json = parseToolJson(
      await registerTools().get("desktop_capture_and_find_template")!({
        source: "window",
        windowId: "win-1",
        image: { base64: bytes.toString("base64"), mimeType: "image/png" },
        confidence: 0.9,
        scale: true,
        all: true,
        detail: "high",
        debugImage: true,
      })
    );

    expect(windows.region).toHaveBeenCalledWith("win-1");
    expect(screen.captureWindow).toHaveBeenCalledWith("win-1");
    expect(artifacts.workspaceImageStore.writeCapture).toHaveBeenCalledWith(
      capture.window,
      { prefix: "desktop-capture-template", detail: "high" }
    );
    expect(core.imageFindAll).toHaveBeenCalledWith(capture.window, bytes, {
      confidence: 0.9,
      region: undefined,
      scale: true,
    });
    expect(json).toMatchObject({
      imagePath: ".spotter/artifacts/window-capture.png",
      source: "window",
      windowId: "win-1",
      origin: { x: 100, y: 200 },
      coordinateSpace: "screen",
      matches: [
        {
          region: { left: 105, top: 207, width: 20, height: 10 },
          center: { x: 115, y: 212 },
        },
      ],
      debugImagePath: ".spotter/artifacts/visual-debug.png",
    });
    expect(debugDraw.writeDebugCapture).toHaveBeenCalledWith(
      capture.window,
      expect.arrayContaining([
        expect.objectContaining({
          kind: "region",
          region: { left: 5, top: 7, width: 20, height: 10 },
        }),
      ]),
      { prefix: "desktop-capture-template-debug" }
    );
  });
});

describe("desktop_find_template_and_tap", () => {
  it("taps the translated best-match center and returns the tap point", async () => {
    core.imageFind.mockResolvedValue({
      region: { left: 3, top: 4, width: 10, height: 8 },
      center: { x: 8, y: 8 },
      score: 0.97,
      matchScore: 0.97,
      matchAlgorithm: "ncc",
    });

    const json = parseToolJson(
      await registerTools().get("desktop_find_template_and_tap")!({
        image: { path: "button.png" },
        region: { left: 10, top: 20, width: 100, height: 80 },
        button: "right",
        debugImage: true,
      })
    );

    expect(core.imageFind).toHaveBeenCalledWith(capture.screen, "button.png", {
      confidence: undefined,
      region: undefined,
      scale: undefined,
    });
    expect(mouse.tap).toHaveBeenCalledWith(18, 28, "right");
    expect(json).toMatchObject({
      coordinateSpace: "screen",
      match: {
        region: { left: 13, top: 24, width: 10, height: 8 },
        center: { x: 18, y: 28 },
      },
      tapPoint: { x: 18, y: 28 },
      debugImagePath: ".spotter/artifacts/visual-debug.png",
    });
  });

  it("does not tap when template matching fails", async () => {
    core.imageFind.mockRejectedValue(new Error("no match"));

    const result = await registerTools().get("desktop_find_template_and_tap")!({
      image: { path: "missing.png" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(
      "desktop_find_template_and_tap failed: no match"
    );
    expect(mouse.tap).not.toHaveBeenCalled();
  });
});

describe("visual combo tool schemas", () => {
  it("sets agent-friendly defaults and validates bounded fields", async () => {
    const schema = registerToolEntries().get("desktop_capture_and_find_template")!
      .config.inputSchema;

    expect(schema.source.parse(undefined)).toBe("screen");
    expect(schema.detail.parse(undefined)).toBe("original");
    expect(schema.source.parse("window")).toBe("window");
    expect(() =>
      schema.region.parse({ left: 0, top: 0, width: 0, height: 1 })
    ).toThrow();
    expect(() => schema.confidence.parse(2)).toThrow();
    expect(() => schema.scale._def.options[1].shape.step.parse(-0.1)).toThrow();

    const result = await registerTools().get("desktop_capture_and_find_template")!({
      source: "window",
      image: { path: "button.png" },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('source "window" requires windowId');
  });
});
