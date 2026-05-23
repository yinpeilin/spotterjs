import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const findAllTemplates = vi.fn();
const tapAt = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    getScreenWidth: () => 1920,
    getScreenHeight: () => 1080,
    getScreenSize: () => ({ width: 1920, height: 1080 }),
    captureScreen: () => ({ data: Buffer.alloc(0), width: 0, height: 0 }),
    findTemplate,
    findAllTemplates,
    tapAt,
  }),
}));

import { screen } from "./screen";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  tapAt.mockReset();
});

describe("screen.find", () => {
  it("calls findTemplate for path needles and returns a MatchResult", async () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 5, height: 5 },
      score: 0.93,
    });

    const match = await screen.find("x.png", { confidence: 0.9 });

    expect(findTemplate).toHaveBeenCalledWith("x.png", undefined, {
      confidence: 0.9,
      searchRegion: undefined,
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(match).toEqual({
      region: { left: 10, top: 20, width: 5, height: 5 },
      center: { x: 12, y: 22 },
      score: 0.93,
    });
  });

  it("passes Buffer as encoded image bytes to findTemplate", async () => {
    findTemplate.mockReturnValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      score: 0.9,
    });
    const buf = Buffer.from("png");

    await screen.find(buf, { multiScale: true });

    expect(findTemplate).toHaveBeenCalledWith("", buf, {
      confidence: undefined,
      searchRegion: undefined,
      multiScale: true,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
  });
});

describe("screen.findAll", () => {
  it("returns MatchResult entries with centers and scores", async () => {
    findAllTemplates.mockReturnValue([
      { region: { left: 4, top: 6, width: 8, height: 10 }, score: 0.88 },
    ]);

    const matches = await screen.findAll("x.png");

    expect(matches).toEqual([
      {
        region: { left: 4, top: 6, width: 8, height: 10 },
        center: { x: 8, y: 11 },
        score: 0.88,
      },
    ]);
  });
});

describe("screen.tapTemplate", () => {
  it("taps the MatchResult center and returns the MatchResult", () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 6, height: 8 },
      score: 0.92,
    });

    const match = screen.tapTemplate("x.png");

    expect(tapAt).toHaveBeenCalledWith(13, 24);
    expect(match).toEqual({
      region: { left: 10, top: 20, width: 6, height: 8 },
      center: { x: 13, y: 24 },
      score: 0.92,
    });
  });
});
