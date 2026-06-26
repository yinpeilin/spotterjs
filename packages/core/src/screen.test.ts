import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const findAllTemplates = vi.fn();
const waitForTemplate = vi.fn();
const tapAt = vi.fn();
const getPixelColor = vi.fn();
const findColor = vi.fn();
const findAllColor = vi.fn();
const waitForColor = vi.fn();
const regionDiff = vi.fn();
const waitForScreenStable = vi.fn();
const encodeCapturePng = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    getScreenWidth: () => 1920,
    getScreenHeight: () => 1080,
    getScreenSize: () => ({ width: 1920, height: 1080 }),
    captureScreen: () => ({ data: Buffer.alloc(0), width: 0, height: 0 }),
    findTemplate,
    findAllTemplates,
    waitForTemplate,
    tapAt,
    getPixelColor,
    findColor,
    findAllColor,
    waitForColor,
    regionDiff,
    waitForScreenStable,
    encodeCapturePng,
  }),
}));

import { screen } from "./screen";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  waitForTemplate.mockReset();
  tapAt.mockReset();
  getPixelColor.mockReset();
  findColor.mockReset();
  findAllColor.mockReset();
  waitForColor.mockReset();
  regionDiff.mockReset();
  waitForScreenStable.mockReset();
  encodeCapturePng.mockReset();
});

describe("screen.findTemplate", () => {
  it("calls findTemplate for path needles and returns a MatchResult", async () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 5, height: 5 },
      score: 0.93,
    });

    const match = await screen.findTemplate("x.png", {
      confidence: 0.9,
      region: { left: 1, top: 2, width: 30, height: 40 },
      scale: { min: 0.8, max: 1.2, step: 0.05 },
    });

    expect(findTemplate).toHaveBeenCalledWith("x.png", undefined, {
      confidence: 0.9,
      searchRegion: { left: 1, top: 2, width: 30, height: 40 },
      multiScale: true,
      scaleMin: 0.8,
      scaleMax: 1.2,
      scaleStep: 0.05,
    });
    expect(match).toEqual({
      region: { left: 10, top: 20, width: 5, height: 5 },
      center: { x: 12, y: 22 },
      score: 0.93,
      matchScore: 0.93,
      matchAlgorithm: "ncc",
    });
  });

  it("passes Buffer as encoded image bytes to findTemplate", async () => {
    findTemplate.mockReturnValue({
      region: { left: 1, top: 2, width: 3, height: 4 },
      score: 0.9,
    });
    const buf = Buffer.from("png");

    await screen.findTemplate(buf, { scale: true });

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

describe("screen.findAllTemplates", () => {
  it("returns MatchResult entries with centers and scores", async () => {
    findAllTemplates.mockReturnValue([
      { region: { left: 4, top: 6, width: 8, height: 10 }, score: 0.88 },
    ]);

    const matches = await screen.findAllTemplates("x.png");

    expect(matches).toEqual([
      {
        region: { left: 4, top: 6, width: 8, height: 10 },
        center: { x: 8, y: 11 },
        score: 0.88,
        matchScore: 0.88,
        matchAlgorithm: "ncc",
      },
    ]);
  });
});

describe("screen.waitForTemplate", () => {
  it("uses an options object for timeout and interval", async () => {
    waitForTemplate.mockReturnValue({
      region: { left: 1, top: 2, width: 6, height: 8 },
      score: 0.91,
    });

    const match = await screen.waitForTemplate("x.png", {
      timeoutMs: 500,
      intervalMs: 25,
      confidence: 0.9,
      region: { left: 10, top: 20, width: 30, height: 40 },
    });

    expect(waitForTemplate).toHaveBeenCalledWith(
      "x.png",
      undefined,
      500,
      {
        confidence: 0.9,
        searchRegion: { left: 10, top: 20, width: 30, height: 40 },
        multiScale: undefined,
        scaleMin: undefined,
        scaleMax: undefined,
        scaleStep: undefined,
      },
      25
    );
    expect(match.center).toEqual({ x: 4, y: 6 });
  });
});

describe("screen.tapTemplate", () => {
  it("taps the MatchResult center and returns the MatchResult", async () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 6, height: 8 },
      score: 0.92,
    });

    const match = await screen.tapTemplate("x.png");

    expect(tapAt).toHaveBeenCalledWith(13, 24);
    expect(match).toEqual({
      region: { left: 10, top: 20, width: 6, height: 8 },
      center: { x: 13, y: 24 },
      score: 0.92,
      matchScore: 0.92,
      matchAlgorithm: "ncc",
    });
  });
});

describe("screen.color", () => {
  it("parses hex colors and forwards tolerance and region", () => {
    findColor.mockReturnValue({ x: 10, y: 20 });

    const point = screen.color.find("#0a1B2c", {
      tolerance: 7,
      region: { left: 1, top: 2, width: 30, height: 40 },
    });

    expect(findColor).toHaveBeenCalledWith(
      { r: 10, g: 27, b: 44 },
      7,
      { left: 1, top: 2, width: 30, height: 40 }
    );
    expect(point).toEqual({ x: 10, y: 20 });
  });

  it("finds all colors and reads a single pixel", () => {
    getPixelColor.mockReturnValue({ r: 1, g: 2, b: 3 });
    findAllColor.mockReturnValue([{ x: 4, y: 5 }]);

    expect(screen.color.get(7, 8)).toEqual({ r: 1, g: 2, b: 3 });
    expect(screen.color.findAll({ r: 1, g: 2, b: 3 })).toEqual([{ x: 4, y: 5 }]);
    expect(getPixelColor).toHaveBeenCalledWith(7, 8);
    expect(findAllColor).toHaveBeenCalledWith({ r: 1, g: 2, b: 3 }, 0, undefined);
  });

  it("waits for a color with explicit polling options", () => {
    waitForColor.mockReturnValue(true);

    expect(
      screen.color.wait(5, 6, "#112233", {
        tolerance: 4,
        timeoutMs: 500,
        intervalMs: 25,
      })
    ).toBe(true);

    expect(waitForColor).toHaveBeenCalledWith(
      5,
      6,
      { r: 17, g: 34, b: 51 },
      4,
      500,
      25
    );
  });
});

describe("screen.diff", () => {
  it("diffs two captures and waits for stability", () => {
    const a = { data: Buffer.alloc(16), width: 2, height: 2 };
    const b = { data: Buffer.alloc(16), width: 2, height: 2 };
    regionDiff.mockReturnValue({ meanAbsDiff: 0.25, changedFraction: 0.5 });
    waitForScreenStable.mockReturnValue(true);

    expect(screen.diff(a, b, { perPixelThreshold: 3 })).toEqual({
      meanAbsDiff: 0.25,
      changedFraction: 0.5,
    });
    expect(screen.waitForStable({ threshold: 0.02, settleMs: 250 })).toBe(true);
    expect(regionDiff).toHaveBeenCalledWith(a, b, 3);
    expect(waitForScreenStable).toHaveBeenCalledWith(undefined, 0.02, 250, 5000, 100);
  });
});
