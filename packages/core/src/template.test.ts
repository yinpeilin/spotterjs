import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findNeedleInWindow: vi.fn(),
  findAllNeedleInWindow: vi.fn(),
  tapAt: vi.fn(),
}));

vi.mock("./match", () => ({
  findNeedleInWindow: mocks.findNeedleInWindow,
  findAllNeedleInWindow: mocks.findAllNeedleInWindow,
}));

vi.mock("./native", () => ({
  loadNative: () => ({ tapAt: mocks.tapAt }),
}));

import { findAllInWindow, findInWindow, tapInWindow } from "./template";

const match = {
  region: { left: 10, top: 20, width: 8, height: 6 },
  center: { x: 14, y: 23 },
  score: 0.92,
  matchScore: 0.92,
  matchAlgorithm: "ncc" as const,
};

beforeEach(() => {
  mocks.findNeedleInWindow.mockReset();
  mocks.findAllNeedleInWindow.mockReset();
  mocks.tapAt.mockReset();
});

describe("template window helpers", () => {
  it("finds one template by delegating to the shared window matcher", () => {
    mocks.findNeedleInWindow.mockReturnValue(match);

    expect(findInWindow("0x1", "button.png", { confidence: 0.8 })).toBe(match);
    expect(mocks.findNeedleInWindow).toHaveBeenCalledWith("0x1", "button.png", {
      confidence: 0.8,
    });
  });

  it("finds all templates by delegating to the shared window matcher", () => {
    mocks.findAllNeedleInWindow.mockReturnValue([match]);

    expect(findAllInWindow("0x1", Buffer.from("png"))).toEqual([match]);
    expect(mocks.findAllNeedleInWindow).toHaveBeenCalledWith("0x1", Buffer.from("png"), undefined);
  });

  it("taps the found match center and returns the match", () => {
    mocks.findNeedleInWindow.mockReturnValue(match);

    expect(tapInWindow("0x1", "button.png")).toBe(match);
    expect(mocks.tapAt).toHaveBeenCalledWith(14, 23);
  });
});
