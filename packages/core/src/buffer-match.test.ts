import { beforeEach, describe, expect, it, vi } from "vitest";

const findTemplateBuffers = vi.fn();
const findAllTemplateBuffers = vi.fn();
const waitForTemplateBuffers = vi.fn();
const loadImageFromPath = vi.fn();
const loadImageFromBuffer = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplateBuffers,
    findAllTemplateBuffers,
    waitForTemplateBuffers,
    loadImageFromPath,
    loadImageFromBuffer,
  }),
}));

import {
  findAllInCapture,
  findInCapture,
  waitForInCapture,
} from "./buffer-match";
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
  waitForTemplateBuffers.mockReset();
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
  waitForTemplateBuffers.mockReturnValue({
    region: { left: 5, top: 9, width: 10, height: 6 },
    score: 0.93,
  });
});

describe("findInCapture", () => {
  it("matches a path needle against a provided capture", async () => {
    const match = await findInCapture(haystack, "button.png", {
      confidence: 0.9,
    });

    expect(loadImageFromPath).toHaveBeenCalledWith("button.png");
    expect(findTemplateBuffers).toHaveBeenCalledWith(haystack, needleCapture, {
      confidence: 0.9,
      searchRegion: undefined,
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

    await findInCapture(haystack, encoded);

    expect(loadImageFromBuffer).toHaveBeenCalledWith(encoded);
    expect(findTemplateBuffers).toHaveBeenCalledWith(
      haystack,
      needleCapture,
      undefined
    );
  });
});

describe("findAllInCapture", () => {
  it("returns all buffer matches with centers", async () => {
    const matches = await findAllInCapture(haystack, "button.png");

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

describe("waitForInCapture", () => {
  it("delegates to native waitForTemplateBuffers", async () => {
    const match = await waitForInCapture(haystack, "button.png", 500, undefined, 25);

    expect(waitForTemplateBuffers).toHaveBeenCalledWith(
      haystack,
      needleCapture,
      500,
      undefined,
      25
    );
    expect(match.center).toEqual({ x: 10, y: 12 });
  });
});
