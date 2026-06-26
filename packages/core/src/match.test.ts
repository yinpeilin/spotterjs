import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const findAllTemplates = vi.fn();
const waitForTemplate = vi.fn();
const findTemplateInWindow = vi.fn();
const findAllTemplatesInWindow = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    findTemplate,
    findAllTemplates,
    waitForTemplate,
    findTemplateInWindow,
    findAllTemplatesInWindow,
  }),
}));

import {
  findAllNeedle,
  findAllNeedleInWindow,
  findNeedle,
  findNeedleInWindow,
  waitForNeedle,
} from "./match";
import { SpotterError } from "./errors";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  waitForTemplate.mockReset();
  findTemplateInWindow.mockReset();
  findAllTemplatesInWindow.mockReset();
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
  findTemplateInWindow.mockReturnValue({
    region: { left: 12, top: 24, width: 8, height: 10 },
    score: 0.94,
  });
  findAllTemplatesInWindow.mockReturnValue([
    { region: { left: 14, top: 28, width: 8, height: 10 }, score: 0.93 },
  ]);
});

describe("findNeedle", () => {
  it("maps confidence, region, and scale to native findTemplate", async () => {
    await findNeedle("needle.png", {
      confidence: 0.85,
      region: { left: 1, top: 2, width: 3, height: 4 },
      scale: { min: 0.8, max: 1.2, step: 0.05 },
      backend: "feature",
    });

    expect(findTemplate).toHaveBeenCalledWith("needle.png", undefined, {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
      multiScale: true,
      scaleMin: 0.8,
      scaleMax: 1.2,
      scaleStep: 0.05,
      backend: "feature",
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

  it("does not enable multi-scale matching when scale is false", async () => {
    await findNeedle("needle.png", { scale: false });

    expect(findTemplate).toHaveBeenCalledWith("needle.png", undefined, {
      confidence: undefined,
      searchRegion: undefined,
      multiScale: undefined,
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
      matchScore: 0.91,
      matchAlgorithm: "ncc",
    });
  });

  it("marks feature backend results with the feature algorithm", async () => {
    findTemplate.mockReturnValue({
      region: { left: 10, top: 20, width: 5, height: 7 },
      score: 0.72,
    });

    const match = await findNeedle("needle.png", { backend: "feature" });

    expect(match).toMatchObject({
      score: 0.72,
      matchScore: 0.72,
      matchAlgorithm: "feature",
    });
  });

  it("wraps native matching errors with stable code and context", async () => {
    const error = new Error(
      `SPOTTER_ERROR_JSON:${JSON.stringify({
        code: "SPOTTER_NATIVE_MATCH_NOT_FOUND",
        message: "template not found",
        domain: "native",
        context: { confidence: 0.99 },
      })}`
    );
    findTemplate.mockImplementation(() => {
      throw error;
    });

    await expect(findNeedle("missing.png", { confidence: 0.99 })).rejects.toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_NATIVE_MATCH_NOT_FOUND",
      message: "findNeedle failed: template not found",
      domain: "native",
      context: {
        api: "findNeedle",
        confidence: 0.99,
        needle: "path",
      },
    });
    await expect(findNeedle("missing.png")).rejects.toBeInstanceOf(SpotterError);
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
        matchScore: 0.95,
        matchAlgorithm: "ncc",
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
      matchScore: 0.96,
      matchAlgorithm: "ncc",
    });
  });
});

describe("findNeedleInWindow", () => {
  it("uses the shared needle and option mapping for window matching", () => {
    const buf = Buffer.from("needle");

    const match = findNeedleInWindow("123", buf, {
      confidence: 0.9,
      region: { left: 1, top: 2, width: 3, height: 4 },
      scale: true,
    });

    expect(findTemplateInWindow).toHaveBeenCalledWith("123", "", buf, {
      confidence: 0.9,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
      multiScale: true,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(match).toEqual({
      region: { left: 12, top: 24, width: 8, height: 10 },
      center: { x: 16, y: 29 },
      score: 0.94,
      matchScore: 0.94,
      matchAlgorithm: "ncc",
    });
  });

  it("returns all window matches through the shared result mapper", () => {
    const matches = findAllNeedleInWindow("123", "button.png");

    expect(findAllTemplatesInWindow).toHaveBeenCalledWith(
      "123",
      "button.png",
      undefined,
      undefined
    );
    expect(matches).toEqual([
      {
        region: { left: 14, top: 28, width: 8, height: 10 },
        center: { x: 18, y: 33 },
        score: 0.93,
        matchScore: 0.93,
        matchAlgorithm: "ncc",
      },
    ]);
  });
});
