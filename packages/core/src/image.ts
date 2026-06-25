import * as fs from "node:fs";
import * as path from "node:path";
import {
  type CaptureImage,
  type MatchOptions,
  type MatchResult,
} from "@spotterjs/base";
import { callNative, SpotterError } from "./errors";
import { loadNative } from "./native";
import { toMatchResult, toNativeOpts } from "./match-shared";

export type ImageFormat = "png" | "jpeg" | "webp";

export type ImageSource =
  | string
  | Buffer
  | CaptureImage
  | { path: string }
  | { bytes: Buffer; mimeType?: string }
  | { capture: CaptureImage };

export type ImageSize = {
  width: number;
  height: number;
};

export type ImageSaveOptions = {
  format?: "png";
  overwrite?: boolean;
};

export type ImageArtifact = {
  path: string;
  width: number;
  height: number;
  format: "png";
  bytes: number;
};

function isCaptureImage(source: unknown): source is CaptureImage {
  return (
    !!source &&
    typeof source === "object" &&
    "data" in source &&
    "width" in source &&
    "height" in source
  );
}

function assertPngFormat(format: string | undefined): void {
  if (format !== undefined && format !== "png") {
    throw new SpotterError(
      "SPOTTER_CORE_IMAGE_FORMAT_UNSUPPORTED",
      "image.encode only supports png output",
      { context: { format }, domain: "core" }
    );
  }
}

function load(source: ImageSource): CaptureImage {
  const native = loadNative();
  if (typeof source === "string") {
    return callNative("image.load", { source: "path", path: source }, () =>
      native.loadImageFromPath(source)
    );
  }
  if (Buffer.isBuffer(source)) {
    return callNative("image.load", { source: "buffer" }, () =>
      native.loadImageFromBuffer(source)
    );
  }
  if (isCaptureImage(source)) return source;
  if ("path" in source) {
    return callNative("image.load", { source: "path", path: source.path }, () =>
      native.loadImageFromPath(source.path)
    );
  }
  if ("bytes" in source) {
    return callNative("image.load", { source: "buffer", mimeType: source.mimeType }, () =>
      native.loadImageFromBuffer(source.bytes)
    );
  }
  return source.capture;
}

function read(imagePath: string): CaptureImage {
  return callNative("image.read", { path: imagePath }, () =>
    loadNative().loadImageFromPath(imagePath)
  );
}

function decode(bytes: Buffer): CaptureImage {
  return callNative("image.decode", { source: "buffer" }, () =>
    loadNative().loadImageFromBuffer(bytes)
  );
}

function encode(capture: CaptureImage, options?: { format?: "png" }): Buffer {
  assertPngFormat(options?.format);
  return callNative("image.encode", { format: options?.format ?? "png" }, () =>
    loadNative().encodeCapturePng(capture)
  );
}

function encodeBase64(capture: CaptureImage, options?: { format?: "png" }): string {
  assertPngFormat(options?.format);
  return callNative("image.encodeBase64", { format: options?.format ?? "png" }, () =>
    loadNative().encodeCapturePngBase64(capture)
  );
}

function save(
  capture: CaptureImage,
  targetPath: string,
  options?: ImageSaveOptions
): ImageArtifact {
  assertPngFormat(options?.format);
  if (fs.existsSync(targetPath) && options?.overwrite !== true) {
    throw new SpotterError(
      "SPOTTER_CORE_IMAGE_ALREADY_EXISTS",
      `image already exists: ${targetPath}`,
      { context: { path: targetPath }, domain: "core" }
    );
  }

  const png = encode(capture, { format: "png" });
  fs.mkdirSync(path.dirname(path.resolve(targetPath)), { recursive: true });
  fs.writeFileSync(targetPath, png);
  return {
    path: targetPath,
    width: capture.width,
    height: capture.height,
    format: "png",
    bytes: png.length,
  };
}

function size(source: string | Buffer | CaptureImage): ImageSize {
  if (typeof source === "string") {
    return callNative("image.size", { source: "path", path: source }, () =>
      loadNative().getImageSize(source)
    );
  }
  if (Buffer.isBuffer(source)) {
    const decoded = decode(source);
    return { width: decoded.width, height: decoded.height };
  }
  return { width: source.width, height: source.height };
}

async function findTemplate(
  haystack: CaptureImage,
  needle: ImageSource,
  options?: MatchOptions
): Promise<MatchResult> {
  const loadedNeedle = load(needle);
  return callNative("image.findTemplate", { needle: Buffer.isBuffer(needle) ? "buffer" : "source" }, () =>
    toMatchResult(
      loadNative().findTemplateBuffers(haystack, loadedNeedle, toNativeOpts(options))
    )
  );
}

async function findAllTemplates(
  haystack: CaptureImage,
  needle: ImageSource,
  options?: MatchOptions
): Promise<MatchResult[]> {
  const loadedNeedle = load(needle);
  return callNative("image.findAllTemplates", { needle: Buffer.isBuffer(needle) ? "buffer" : "source" }, () =>
    loadNative()
      .findAllTemplateBuffers(haystack, loadedNeedle, toNativeOpts(options))
      .map(toMatchResult)
  );
}

export const image = {
  load,
  read,
  decode,
  encode,
  encodeBase64,
  save,
  size,
  findTemplate,
  findAllTemplates,
};
