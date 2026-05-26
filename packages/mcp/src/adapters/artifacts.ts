import type { CaptureImage } from "@spotterjs/base";
import { encodePng } from "@spotterjs/core";
import * as fs from "node:fs";
import * as path from "node:path";

export const DEFAULT_CAPTURE_MAX_LONG_EDGE = 1600;

/** Capture artifact detail level requested by MCP callers. */
export type CaptureArtifactDetail = "high" | "original";

/** Metadata returned after writing a capture PNG into the workspace. */
export type CaptureArtifact = {
  /** Workspace-relative PNG path. */
  imagePath: string;
  /** Width of the written image in pixels. */
  width: number;
  /** Height of the written image in pixels. */
  height: number;
  /** Width of the source capture before downscaling. */
  originalWidth: number;
  /** Height of the source capture before downscaling. */
  originalHeight: number;
  /** Artifact image format. */
  format: "png";
  /** Whether the written image was downscaled from the source capture. */
  isDownscaled: boolean;
  /** Detail level used when writing the artifact. */
  detail: CaptureArtifactDetail;
};

/** Options used when persisting a capture artifact. */
export type WriteCaptureOptions = {
  /** Safe filename prefix used in `.spotter/artifacts`. */
  prefix: string;
  /** Maximum long edge for `high` detail captures. Defaults to 1600. */
  maxLongEdge?: number;
  /** Use `original` to preserve source dimensions; defaults to `high`. */
  detail?: CaptureArtifactDetail;
};

/** Downscale a capture with nearest-neighbor sampling when it exceeds `maxLongEdge`. */
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

/** Write a capture PNG and sidecar JSON metadata file under the workspace. */
export function writeCaptureArtifact(
  capture: CaptureImage,
  options: WriteCaptureOptions
): CaptureArtifact {
  const detail = options.detail ?? "high";
  const optimized =
    detail === "original"
      ? capture
      : optimizeCapture(
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
    detail,
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
  const srcXs = new Array<number>(width);
  for (let x = 0; x < width; x++) {
    srcXs[x] = Math.min(
      image.width - 1,
      Math.floor((x * image.width) / width)
    );
  }

  for (let y = 0; y < height; y++) {
    const srcY = Math.min(
      image.height - 1,
      Math.floor((y * image.height) / height)
    );
    const srcRow = srcY * image.width;
    const dstRow = y * width;
    for (let x = 0; x < width; x++) {
      const src = (srcRow + srcXs[x]) * 4;
      const dst = (dstRow + x) * 4;
      data[dst] = image.data[src];
      data[dst + 1] = image.data[src + 1];
      data[dst + 2] = image.data[src + 2];
      data[dst + 3] = image.data[src + 3];
    }
  }
  return { data, width, height };
}
