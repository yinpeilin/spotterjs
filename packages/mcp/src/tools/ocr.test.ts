import { beforeEach, describe, expect, it, vi } from "vitest";

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

const debugDraw = vi.hoisted(() => {
  const z = require("zod");
  return {
    debugImageField: { debugImage: z.boolean().optional() },
    writeDebugImageFromPath: vi.fn(() => ({
      imagePath: ".spotter/artifacts/ocr-debug.png",
      width: 100,
      height: 50,
      originalWidth: 100,
      originalHeight: 50,
      format: "png",
      isDownscaled: false,
      detail: "original",
    })),
  };
});

vi.mock("@spotterjs/plugin-ocr", () => ({
  createOcr: plugin.createOcr,
  scoreOcrText: plugin.scoreOcrText,
}));

vi.mock("../adapters/debug-draw.js", () => debugDraw);

import { registerOcrTools } from "./ocr.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }> }>;
type RegisteredTool = { config: any; handler: ToolHandler };

function registerToolEntries(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool(name: string, config: unknown, handler: ToolHandler) {
      tools.set(name, { config, handler });
    },
  };

  registerOcrTools(server as never);
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
  plugin.createOcr.mockReset();
  plugin.scoreOcrText.mockClear();
  ocr.read.mockReset();
  ocr.findAllText.mockReset();
  debugDraw.writeDebugImageFromPath.mockClear();
  plugin.createOcr.mockResolvedValue(ocr);
});

describe("ocr MCP tools", () => {
  it("reads OCR lines from imagePath", async () => {
    ocr.read.mockResolvedValue([{ text: "hello", score: 0.9 }]);

    const result = await registerTools().get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/cap.png",
      modelProfile: "mobile",
    });
    const json = parseToolJson(result);

    expect(plugin.createOcr).toHaveBeenCalledWith({
      modelDir: undefined,
      modelProfile: "mobile",
    });
    expect(ocr.read).toHaveBeenCalledWith(".spotter/artifacts/cap.png", {
      searchRegion: undefined,
      origin: undefined,
    });
    expect(json.lines[0].text).toBe("hello");
  });

  it("reuses OCR clients for the same model options", async () => {
    ocr.read.mockResolvedValue([]);
    const tools = registerTools();

    await tools.get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/a.png",
      modelProfile: "server",
    });
    await tools.get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/b.png",
      modelProfile: "server",
    });

    expect(plugin.createOcr).toHaveBeenCalledTimes(1);
  });

  it("uses bounded schemas for OCR regions", () => {
    const schema = registerToolEntries().get("ocr_read_image")!.config.inputSchema;

    expect(() =>
      schema.searchRegion.parse({ left: 0, top: 0, width: 0, height: 10 })
    ).toThrow();
    expect(() => schema.origin.parse({ x: Number.NaN, y: 0 })).toThrow();
    expect(schema.debugImage.parse(true)).toBe(true);
  });

  it("finds matching OCR text from imagePath", async () => {
    ocr.findAllText.mockResolvedValue([{ text: "Send", score: 0.95 }]);

    const result = await registerTools().get("ocr_find_text")!({
      imagePath: ".spotter/artifacts/cap.png",
      text: "Send",
      exact: true,
    });
    const json = parseToolJson(result);

    expect(ocr.findAllText).toHaveBeenCalledWith(
      ".spotter/artifacts/cap.png",
      "Send",
      {
        exact: true,
        caseSensitive: undefined,
        minSimilarity: undefined,
        searchRegion: undefined,
        origin: undefined,
      }
    );
    expect(json.matches[0].text).toBe("Send");
  });

  it("passes minSimilarity through to OCR text matching", async () => {
    ocr.findAllText.mockResolvedValue([
      {
        text: "Setting",
        score: 0.8,
        matchScore: 0.875,
        matchAlgorithm: "ocr-text",
        matchKind: "similarity",
        query: "Settings",
        matched: true,
      },
    ]);

    await registerTools().get("ocr_find_text")!({
      imagePath: ".spotter/artifacts/cap.png",
      text: "Settings",
      minSimilarity: 0.85,
    });

    expect(ocr.findAllText).toHaveBeenCalledWith(
      ".spotter/artifacts/cap.png",
      "Settings",
      expect.objectContaining({ minSimilarity: 0.85 })
    );
  });

  it("returns scored OCR candidates and a debug image when requested", async () => {
    const lines = [
      {
        text: "Send",
        score: 0.95,
        region: { left: 10, top: 20, width: 30, height: 12 },
        box: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 32 },
          { x: 10, y: 32 },
        ],
        center: { x: 25, y: 26 },
      },
      {
        text: "Save",
        score: 0.9,
        region: { left: 50, top: 20, width: 30, height: 12 },
        box: [
          { x: 50, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 32 },
          { x: 50, y: 32 },
        ],
        center: { x: 65, y: 26 },
      },
    ];
    ocr.read.mockResolvedValue(lines);

    const result = await registerTools().get("ocr_find_text")!({
      imagePath: ".spotter/artifacts/cap.png",
      text: "Send",
      exact: true,
      debugImage: true,
    });
    const json = parseToolJson(result);

    expect(ocr.findAllText).not.toHaveBeenCalled();
    expect(ocr.read).toHaveBeenCalledWith(".spotter/artifacts/cap.png", {
      searchRegion: undefined,
      origin: undefined,
    });
    expect(plugin.scoreOcrText).toHaveBeenCalledTimes(2);
    expect(json.matches).toHaveLength(1);
    expect(json.candidates).toHaveLength(2);
    expect(json.matches[0].score).toBe(0.95);
    expect(json.matches[0].matchScore).toBe(1);
    expect(json.candidates[1].score).toBe(0.9);
    expect(json.candidates[1].matchScore).toBe(0);
    expect(json.debugImagePath).toBe(".spotter/artifacts/ocr-debug.png");
    expect(debugDraw.writeDebugImageFromPath).toHaveBeenCalledWith(
      ".spotter/artifacts/cap.png",
      expect.arrayContaining([
        expect.objectContaining({ kind: "polygon" }),
        expect.objectContaining({ kind: "point" }),
      ]),
      { prefix: "ocr-find-text-debug", origin: undefined }
    );
  });

  it("returns a debug image for OCR reads when requested", async () => {
    ocr.read.mockResolvedValue([
      {
        text: "hello",
        score: 0.9,
        region: { left: 1, top: 2, width: 3, height: 4 },
        box: [
          { x: 1, y: 2 },
          { x: 4, y: 2 },
          { x: 4, y: 6 },
          { x: 1, y: 6 },
        ],
        center: { x: 2, y: 4 },
      },
    ]);

    const json = parseToolJson(
      await registerTools().get("ocr_read_image")!({
        imagePath: ".spotter/artifacts/cap.png",
        debugImage: true,
      })
    );

    expect(json.debugImagePath).toBe(".spotter/artifacts/ocr-debug.png");
    expect(debugDraw.writeDebugImageFromPath).toHaveBeenCalledWith(
      ".spotter/artifacts/cap.png",
      expect.any(Array),
      { prefix: "ocr-read-image-debug", origin: undefined }
    );
  });

  it("returns MCP errors when OCR client creation fails", async () => {
    plugin.createOcr.mockRejectedValue(new Error("models missing"));

    const result = await registerTools().get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/cap.png",
      modelDir: "missing",
    });

    expect(result).toMatchObject({
      isError: true,
      content: [{ text: "ocr_read_image failed: models missing" }],
    });
  });

  it("creates separate OCR clients for different model options", async () => {
    ocr.read.mockResolvedValue([]);
    const tools = registerTools();

    await tools.get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/a.png",
      modelDir: "dir-a",
      modelProfile: "server",
    });
    await tools.get("ocr_read_image")!({
      imagePath: ".spotter/artifacts/b.png",
      modelDir: "dir-b",
      modelProfile: "mobile",
    });

    expect(plugin.createOcr).toHaveBeenCalledTimes(2);
    expect(plugin.createOcr).toHaveBeenNthCalledWith(1, {
      modelDir: "dir-a",
      modelProfile: "server",
    });
    expect(plugin.createOcr).toHaveBeenNthCalledWith(2, {
      modelDir: "dir-b",
      modelProfile: "mobile",
    });
  });
});
