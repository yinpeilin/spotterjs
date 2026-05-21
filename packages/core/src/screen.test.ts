import { describe, it, expect, vi, beforeEach } from "vitest";

const findTemplate = vi.fn();
const tapAt = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    getScreenWidth: () => 1920,
    getScreenHeight: () => 1080,
    getScreenSize: () => ({ width: 1920, height: 1080 }),
    captureScreen: () => ({ data: Buffer.alloc(0), width: 0, height: 0 }),
    findTemplate,
    tapAt,
  }),
}));

import { screen } from "./screen";

beforeEach(() => {
  findTemplate.mockReset();
  tapAt.mockReset();
});

describe("screen.find", () => {
  it("calls findTemplate for path needles", async () => {
    findTemplate.mockReturnValue({ left: 10, top: 20, width: 5, height: 5 });
    const region = await screen.find("x.png", { confidence: 0.9 });
    expect(findTemplate).toHaveBeenCalledWith("x.png", undefined, {
      confidence: 0.9,
      searchRegion: undefined,
      multiScale: undefined,
      scaleMin: undefined,
      scaleMax: undefined,
      scaleStep: undefined,
    });
    expect(region.left).toBe(10);
  });

  it("passes Buffer as second arg to findTemplate", async () => {
    findTemplate.mockReturnValue({ left: 1, top: 2, width: 3, height: 4 });
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
