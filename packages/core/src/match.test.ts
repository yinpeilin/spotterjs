import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const findAllTemplates = vi.fn();
const waitForTemplate = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplate,
    findAllTemplates,
    waitForTemplate,
  }),
}));

import { findAllNeedle, findNeedle, waitForNeedle } from "./match";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  waitForTemplate.mockReset();
  findTemplate.mockReturnValue({
    region: { left: 0, top: 0, width: 10, height: 10 },
    score: 0.97,
  });
  findAllTemplates.mockReturnValue([
    { region: { left: 4, top: 8, width: 10, height: 6 }, score: 0.95 },
  ]);
  waitForTemplate.mockReturnValue({
    region: { left: 1, top: 2, width: 10, height: 10 },
    score: 0.96,
  });
});

describe("findNeedle", () => {
  it("maps confidence, region, and scale to native findTemplate", async () => {
    await findNeedle("needle.png", {
      confidence: 0.85,
      region: { left: 1, top: 2, width: 3, height: 4 },
      scale: { min: 0.8, max: 1.2, step: 0.05 },
    });

    expect(findTemplate).toHaveBeenCalledWith("needle.png", undefined, {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
      multiScale: true,
      scaleMin: 0.8,
      scaleMax: 1.2,
      scaleStep: 0.05,
    });
  });

  it("passes Buffer as encoded image bytes to findTemplate", async () => {
    const buf = Buffer.from("x");

    await findNeedle(buf, { scale: true });

    expect(findTemplate).toHaveBeenCalledWith("", buf, {
      confidence: undefined,
      searchRegion: undefined,
      multiScale: true,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
  });

  it("returns a MatchResult with screen center and score", async () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 5, height: 7 },
      score: 0.91,
    });

    const match = await findNeedle("needle.png");

    expect(match).toEqual({
      region: { left: 10, top: 20, width: 5, height: 7 },
      center: { x: 12, y: 23 },
      score: 0.91,
    });
  });
});

describe("findAllNeedle", () => {
  it("routes path needles to findAllTemplates", async () => {
    await findAllNeedle("a.png", { confidence: 0.8 });

    expect(findAllTemplates).toHaveBeenCalledWith("a.png", undefined, {
      confidence: 0.8,
    });
  });

  it("passes Buffer as encoded image bytes to findAllTemplates", async () => {
    const buf = Buffer.from("x");

    await findAllNeedle(buf);

    expect(findAllTemplates).toHaveBeenCalledWith("", buf, undefined);
  });

  it("returns MatchResult entries with centers and scores", async () => {
    const matches = await findAllNeedle("a.png");

    expect(matches).toEqual([
      {
        region: { left: 4, top: 8, width: 10, height: 6 },
        center: { x: 9, y: 11 },
        score: 0.95,
      },
    ]);
  });
});

describe("waitForNeedle", () => {
  it("returns a MatchResult with screen center and score", async () => {
    const match = await waitForNeedle("needle.png", {
      timeoutMs: 500,
      intervalMs: 25,
      confidence: 0.8,
    });

    expect(waitForTemplate).toHaveBeenCalledWith(
      "needle.png",
      undefined,
      500,
      {
        confidence: 0.8,
        searchRegion: undefined,
        multiScale: undefined,
        scaleMin: undefined,
        scaleMax: undefined,
        scaleStep: undefined,
      },
      25
    );
    expect(match).toEqual({
      region: { left: 1, top: 2, width: 10, height: 10 },
      center: { x: 6, y: 7 },
      score: 0.96,
    });
  });
});
