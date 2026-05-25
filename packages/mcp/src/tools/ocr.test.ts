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

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };

  registerOcrTools(server as never);
  return tools;
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
});
