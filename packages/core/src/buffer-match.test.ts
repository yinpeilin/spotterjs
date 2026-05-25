import { beforeEach, describe, expect, it, vi } from "vitest";

const findTemplateBuffers = vi.fn();
const findAllTemplateBuffers = vi.fn();
const loadImageFromPath = vi.fn();
const loadImageFromBuffer = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplateBuffers,
    findAllTemplateBuffers,
    loadImageFromPath,
    loadImageFromBuffer,
  }),
}));

import { image } from "./buffer-match";
import type { CaptureImage } from "@spotterjs/base";

const haystack: CaptureImage = {
  data: Buffer.from("haystack"),
  width: 100,
  height: 80,
};

const needleCapture: CaptureImage = {
  data: Buffer.from("needle"),
  width: 10,
  height: 6,
};

beforeEach(() => {
  findTemplateBuffers.mockReset();
  findAllTemplateBuffers.mockReset();
  loadImageFromPath.mockReset();
  loadImageFromBuffer.mockReset();
  loadImageFromPath.mockReturnValue(needleCapture);
  loadImageFromBuffer.mockReturnValue(needleCapture);
  findTemplateBuffers.mockReturnValue({
    region: { left: 4, top: 8, width: 10, height: 6 },
    score: 0.94,
  });
  findAllTemplateBuffers.mockReturnValue([
    { region: { left: 4, top: 8, width: 10, height: 6 }, score: 0.94 },
  ]);
});

describe("image.decode", () => {
  it("decodes an encoded image buffer", () => {
    const encoded = Buffer.from("encoded");

    expect(image.decode(encoded)).toBe(needleCapture);
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
    });
  });

  it("matches an encoded image buffer needle against a provided capture", async () => {
    const encoded = Buffer.from("encoded");

    await image.find(haystack, encoded);

    expect(loadImageFromBuffer).toHaveBeenCalledWith(encoded);
    expect(findTemplateBuffers).toHaveBeenCalledWith(
      haystack,
      needleCapture,
      undefined
    );
  });
});

describe("image.findAll", () => {
  it("returns all buffer matches with centers", async () => {
    const matches = await image.findAll(haystack, "button.png");

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
      },
    ]);
  });
});
