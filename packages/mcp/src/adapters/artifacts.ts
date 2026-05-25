import type { CaptureImage } from "@spotterjs/base";
import { encodePng } from "@spotterjs/core";
import * as fs from "node:fs";
import * as path from "node:path";

export const DEFAULT_CAPTURE_MAX_LONG_EDGE = 1600;

export type CaptureArtifact = {
  imagePath: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  format: "png";
  isDownscaled: boolean;
};

type WriteCaptureOptions = {
  prefix: string;
  maxLongEdge?: number;
};

export function optimizeCapture(
  capture: CaptureImage,
  maxLongEdge = DEFAULT_CAPTURE_MAX_LONG_EDGE
): CaptureImage {
  const longest = Math.max(capture.width, capture.height);
  if (longest <= maxLongEdge) return capture;

  const scale = maxLongEdge / longest;
  const width = Math.max(1, Math.round(capture.width * scale));
  const height = Math.max(1, Math.round(capture.height * scale));
  return resizeNearest(capture, width, height);
}

export function writeCaptureArtifact(
  capture: CaptureImage,
  options: WriteCaptureOptions
): CaptureArtifact {
  const optimized = optimizeCapture(
    capture,
    options.maxLongEdge ?? DEFAULT_CAPTURE_MAX_LONG_EDGE
  );
  const imagePath = artifactPath(options.prefix, "png");
  const metaPath = imagePath.replace(/\.png$/, ".json");
  const artifact: CaptureArtifact = {
    imagePath,
    width: optimized.width,
    height: optimized.height,
    originalWidth: capture.width,
    originalHeight: capture.height,
    format: "png",
    isDownscaled:
      optimized.width !== capture.width || optimized.height !== capture.height,
  };

  writeArtifactFile(imagePath, encodePng(optimized));
  writeArtifactFile(metaPath, JSON.stringify(artifact, null, 2));
  return artifact;
}

function writeArtifactFile(relativePath: string, content: string | Buffer): void {
  const root = path.resolve(
    process.env.SPOTTERJS_WORKSPACE_ROOT?.trim() || process.cwd()
  );
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`artifact path escapes workspace: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
}

function artifactPath(prefix: string, ext: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "-");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `.spotter/artifacts/${safePrefix}-${stamp}-${nonce}.${ext}`;
}

function resizeNearest(image: CaptureImage, width: number, height: number): CaptureImage {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(
      image.height - 1,
      Math.floor((y * image.height) / height)
    );
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(
        image.width - 1,
        Math.floor((x * image.width) / width)
      );
      const src = (srcY * image.width + srcX) * 4;
      const dst = (y * width + x) * 4;
      image.data.copy(data, dst, src, src + 4);
    }
  }
  return { data, width, height };
}
