import { beforeEach, describe, expect, it, vi } from "vitest";

const ocr = vi.hoisted(() => ({
  read: vi.fn(),
  findAllText: vi.fn(),
}));

const plugin = vi.hoisted(() => ({
  createOcr: vi.fn(),
}));

vi.mock("@spotterjs/plugin-ocr", () => ({
  createOcr: plugin.createOcr,
}));

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
  ocr.read.mockReset();
  ocr.findAllText.mockReset();
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
        searchRegion: undefined,
        origin: undefined,
      }
    );
    expect(json.matches[0].text).toBe("Send");
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
