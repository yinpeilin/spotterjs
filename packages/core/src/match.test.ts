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

import { findAllNeedle, findNeedle } from "./match";

beforeEach(() => {
  findTemplate.mockReset();
  findAllTemplates.mockReset();
  waitForTemplate.mockReset();
  findTemplate.mockResolvedValue({ left: 0, top: 0, width: 10, height: 10 });
  findAllTemplates.mockResolvedValue([]);
  waitForTemplate.mockResolvedValue({ left: 0, top: 0, width: 10, height: 10 });
});

describe("findNeedle", () => {
  it("maps confidence and searchRegion to native findTemplate", async () => {
    await findNeedle("needle.png", {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
    });
    expect(findTemplate).toHaveBeenCalledWith("needle.png", undefined, {
      confidence: 0.85,
      searchRegion: { left: 1, top: 2, width: 3, height: 4 },
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
  });

  it("passes Buffer as second arg to findTemplate", async () => {
    const buf = Buffer.from("x");
    await findNeedle(buf, { multiScale: true });
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

describe("findAllNeedle", () => {
  it("routes path needles to findAllTemplates", async () => {
    await findAllNeedle("a.png", { confidence: 0.8 });
    expect(findAllTemplates).toHaveBeenCalledWith("a.png", undefined, {
      confidence: 0.8,
    });
  });

  it("passes Buffer as second arg to findAllTemplates", async () => {
    const buf = Buffer.from("x");
    await findAllNeedle(buf);
    expect(findAllTemplates).toHaveBeenCalledWith("", buf, undefined);
  });
});
