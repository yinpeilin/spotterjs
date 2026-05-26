import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CaptureImage } from "@spotterjs/base";
import { optimizeCapture, writeCaptureArtifact } from "./artifacts";

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spotter-artifacts-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.SPOTTERJS_WORKSPACE_ROOT;
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function image(width: number, height: number): CaptureImage {
  return {
    width,
    height,
    data: Buffer.alloc(width * height * 4),
  };
}

function pixel(data: Buffer, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return [...data.subarray(offset, offset + 4)];
}

describe("capture artifact optimization", () => {
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

  it("downscales captures with stable nearest-neighbor mapping", () => {
    const width = 4;
    const height = 2;
    const data = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        data[offset] = x * 40;
        data[offset + 1] = y * 80;
        data[offset + 2] = 7;
        data[offset + 3] = 255;
      }
    }

    const optimized = optimizeCapture({ data, width, height }, 2);

    expect(optimized.width).toBe(2);
    expect(optimized.height).toBe(1);
    expect(pixel(optimized.data, optimized.width, 0, 0)).toEqual(pixel(data, width, 0, 0));
    expect(pixel(optimized.data, optimized.width, 1, 0)).toEqual(pixel(data, width, 2, 0));
  });

  it("keeps one-pixel output dimensions for very thin captures", () => {
    const optimized = optimizeCapture(image(1, 10_000), 1600);

    expect(optimized.width).toBe(1);
    expect(optimized.height).toBe(1600);
  });
});

describe("capture artifact writing", () => {
  it("writes a PNG and JSON metadata inside the configured workspace", () => {
    const root = tmpDir();
    process.env.SPOTTERJS_WORKSPACE_ROOT = root;

    const artifact = writeCaptureArtifact(image(2, 1), {
      prefix: "desktop screen!",
    });
    const pngPath = path.join(root, artifact.imagePath);
    const metaPath = pngPath.replace(/\.png$/, ".json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

    expect(artifact.imagePath).toMatch(
      /^\.spotter\/artifacts\/desktop-screen--[\dTZ-]+-[a-z0-9]+\.png$/
    );
    expect(fs.existsSync(pngPath)).toBe(true);
    expect(meta).toEqual(artifact);
  });

  it("records original and optimized dimensions when downscaling", () => {
    const root = tmpDir();
    process.env.SPOTTERJS_WORKSPACE_ROOT = root;

    const artifact = writeCaptureArtifact(image(4000, 2000), {
      prefix: "large",
      maxLongEdge: 1000,
    });

    expect(artifact).toMatchObject({
      width: 1000,
      height: 500,
      originalWidth: 4000,
      originalHeight: 2000,
      isDownscaled: true,
      detail: "high",
      format: "png",
    });
  });

  it("keeps original dimensions when original detail is requested", () => {
    const root = tmpDir();
    process.env.SPOTTERJS_WORKSPACE_ROOT = root;

    const artifact = writeCaptureArtifact(image(4000, 2000), {
      prefix: "large",
      detail: "original",
    });

    expect(artifact).toMatchObject({
      width: 4000,
      height: 2000,
      originalWidth: 4000,
      originalHeight: 2000,
      isDownscaled: false,
      detail: "original",
      format: "png",
    });
  });

  it("keeps malicious prefixes inside the configured workspace", () => {
    const root = tmpDir();
    process.env.SPOTTERJS_WORKSPACE_ROOT = root;

    const artifact = writeCaptureArtifact(image(1, 1), {
      prefix: "../../escape\\name",
    });
    const resolved = path.resolve(root, artifact.imagePath);
    const rel = path.relative(root, resolved);

    expect(rel.startsWith("..")).toBe(false);
    expect(path.isAbsolute(rel)).toBe(false);
    expect(artifact.imagePath).toContain("------escape-name");
    expect(fs.existsSync(resolved)).toBe(true);
  });
});
