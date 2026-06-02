import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaptureImage } from "@spotterjs/base";
import { annotateCapture, writeDebugCapture } from "./debug-draw";

vi.mock("@spotterjs/core", () => ({
  image: {
    encode: vi.fn(() => Buffer.from("png")),
  },
}));

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spotter-debug-draw-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.SPOTTERJS_WORKSPACE_ROOT;
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function capture(width: number, height: number): CaptureImage {
  return {
    width,
    height,
    data: Buffer.alloc(width * height * 4, 0),
  };
}

describe("debug drawing", () => {
  it("draws regions, polygons, and points without mutating the source", () => {
    const source = capture(12, 10);

    const annotated = annotateCapture(source, [
      { kind: "region", region: { left: 2, top: 2, width: 6, height: 4 } },
      {
        kind: "polygon",
        points: [
          { x: 1, y: 1 },
          { x: 8, y: 1 },
          { x: 8, y: 5 },
          { x: 1, y: 5 },
        ],
      },
      { kind: "point", point: { x: 6, y: 5 } },
    ]);

    expect(annotated).not.toBe(source);
    expect(source.data.equals(Buffer.alloc(source.data.length, 0))).toBe(true);
    expect(annotated.data.equals(source.data)).toBe(false);
  });

  it("writes debug images as original-size artifacts", () => {
    const root = tmpDir();
    process.env.SPOTTERJS_WORKSPACE_ROOT = root;

    const artifact = writeDebugCapture(capture(4, 3), [], {
      prefix: "desktop tap debug",
    });

    expect(artifact).toMatchObject({
      width: 4,
      height: 3,
      originalWidth: 4,
      originalHeight: 3,
      detail: "original",
      isDownscaled: false,
      format: "png",
    });
    expect(artifact.imagePath).toMatch(
      /^\.spotter\/artifacts\/desktop-tap-debug-[\dTZ-]+-[a-z0-9]+\.png$/
    );
    expect(fs.existsSync(path.join(root, artifact.imagePath))).toBe(true);
  });
});
