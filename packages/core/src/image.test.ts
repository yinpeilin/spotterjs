import { beforeEach, describe, expect, it, vi } from "vitest";

const findTemplateBuffers = vi.fn();
const findAllTemplateBuffers = vi.fn();
const loadImageFromPath = vi.fn();
const loadImageFromBuffer = vi.fn();
const getImageSize = vi.fn();
const encodeCapturePng = vi.fn();
const encodeCapturePngBase64 = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplateBuffers,
    findAllTemplateBuffers,
    loadImageFromPath,
    loadImageFromBuffer,
    getImageSize,
    encodeCapturePng,
    encodeCapturePngBase64,
  }),
}));

import { image } from "./image";
import type { CaptureImage } from "@spotterjs/base";

const haystack: CaptureImage = {
  data: Buffer.from("haystack"),
  width: 100,
  height: 80,
};

const needleCapture: CaptureImage = {
  data: Buffer.alloc(10 * 6 * 4),
  width: 10,
  height: 6,
};

beforeEach(() => {
  findTemplateBuffers.mockReset();
  findAllTemplateBuffers.mockReset();
  loadImageFromPath.mockReset();
  loadImageFromBuffer.mockReset();
  getImageSize.mockReset();
  encodeCapturePng.mockReset();
  encodeCapturePngBase64.mockReset();

  loadImageFromPath.mockReturnValue(needleCapture);
  loadImageFromBuffer.mockReturnValue(needleCapture);
  getImageSize.mockReturnValue({ width: 10, height: 6 });
  encodeCapturePng.mockReturnValue(Buffer.from("png"));
  encodeCapturePngBase64.mockReturnValue("cG5n");
  findTemplateBuffers.mockReturnValue({
    region: { left: 4, top: 8, width: 10, height: 6 },
    score: 0.94,
  });
  findAllTemplateBuffers.mockReturnValue([
    { region: { left: 4, top: 8, width: 10, height: 6 }, score: 0.94 },
  ]);
});

describe("image.load", () => {
  it("loads path, encoded bytes, and existing captures through one entrypoint", () => {
    const encoded = Buffer.from("encoded");

    expect(image.load("button.png")).toBe(needleCapture);
    expect(image.load({ path: "button.png" })).toBe(needleCapture);
    expect(image.load(encoded)).toBe(needleCapture);
    expect(image.load({ bytes: encoded, mimeType: "image/png" })).toBe(needleCapture);
    expect(image.load({ capture: haystack })).toBe(haystack);
    expect(image.load(haystack)).toBe(haystack);

    expect(loadImageFromPath).toHaveBeenCalledWith("button.png");
    expect(loadImageFromBuffer).toHaveBeenCalledWith(encoded);
  });
});

describe("image encoding", () => {
  it("encodes captures as PNG bytes and base64", () => {
    expect(image.encode(haystack)).toEqual(Buffer.from("png"));
    expect(image.encodeBase64(haystack)).toBe("cG5n");
    expect(encodeCapturePng).toHaveBeenCalledWith(haystack);
    expect(encodeCapturePngBase64).toHaveBeenCalledWith(haystack);
  });

  it("rejects non-PNG output formats", () => {
    expect(() => image.encode(haystack, { format: "jpeg" as never })).toThrow(
      /only supports png/i
    );
  });
});

describe("image.size", () => {
  it("returns dimensions for paths, buffers, and captures", () => {
    const encoded = Buffer.from("encoded");

    expect(image.size("button.png")).toEqual({ width: 10, height: 6 });
    expect(image.size(encoded)).toEqual({ width: 10, height: 6 });
    expect(image.size(haystack)).toEqual({ width: 100, height: 80 });

    expect(getImageSize).toHaveBeenCalledWith("button.png");
    expect(loadImageFromBuffer).toHaveBeenCalledWith(encoded);
  });
});

describe("image.find", () => {
  it("matches a path needle against a provided capture", async () => {
    const match = await image.find(haystack, "button.png", {
      confidence: 0.9,
      region: { left: 1, top: 2, width: 30, height: 40 },
    });

    expect(loadImageFromPath).toHaveBeenCalledWith("button.png");
    expect(findTemplateBuffers).toHaveBeenCalledWith(haystack, needleCapture, {
      confidence: 0.9,
      searchRegion: { left: 1, top: 2, width: 30, height: 40 },
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(match).toEqual({
      region: { left: 4, top: 8, width: 10, height: 6 },
      center: { x: 9, y: 11 },
      score: 0.94,
      matchScore: 0.94,
      matchAlgorithm: "ncc",
    });
  });

  it("matches all results with centers", async () => {
    const matches = await image.findAll(haystack, { capture: needleCapture });

    expect(findAllTemplateBuffers).toHaveBeenCalledWith(
      haystack,
      needleCapture,
      undefined
    );
    expect(matches).toEqual([
      {
        region: { left: 4, top: 8, width: 10, height: 6 },
        center: { x: 9, y: 11 },
        score: 0.94,
        matchScore: 0.94,
        matchAlgorithm: "ncc",
      },
    ]);
  });
});
