import { describe, expect, it } from "vitest";
import type { CaptureImage } from "@spotterjs/base";
import { optimizeCapture } from "./artifacts.js";

function image(width: number, height: number): CaptureImage {
  return {
    width,
    height,
    data: Buffer.alloc(width * height * 4),
  };
}

describe("optimizeCapture", () => {
  it("downscales images whose long edge exceeds 1600", () => {
    const optimized = optimizeCapture(image(2400, 1200));

    expect(optimized.width).toBe(1600);
    expect(optimized.height).toBe(800);
  });

  it("does not upscale smaller images", () => {
    const original = image(800, 600);
    const optimized = optimizeCapture(original);

    expect(optimized).toBe(original);
  });
});
