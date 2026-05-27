import type { CaptureImage, Region } from "@spotterjs/base";
import { image as coreImage } from "@spotterjs/core";
import { OcrError } from "./errors";
import type { OcrImage, OcrPreprocessOptions } from "./types";

export async function loadImage(image: OcrImage): Promise<CaptureImage> {
  if (typeof image === "string" || Buffer.isBuffer(image)) {
    return validateCaptureImage(coreImage.load(image), "image");
  }

  if (!image || typeof image !== "object" || !("data" in image)) {
    throw new OcrError("OCR_IMAGE_INVALID", "image must be a path, Buffer, or CaptureImage", {
      context: { label: "image" },
    });
  }
  const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data);
  return validateCaptureImage({
    data,
    width: image.width,
    height: image.height,
  }, "image");
}

export function cropImage(image: CaptureImage, region?: Region): CaptureImage {
  validateCaptureImage(image, "image");
  if (!region) return image;
  validateRegion(region, "region");

  const left = Math.max(0, region.left);
  const top = Math.max(0, region.top);
  const right = Math.min(image.width, region.left + region.width);
  const bottom = Math.min(image.height, region.top + region.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  if (width <= 0 || height <= 0) {
    throw new OcrError("OCR_IMAGE_INVALID", "crop region is outside image bounds", {
      context: { region, image: imageSummary(image) },
    });
  }
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcStart = ((top + y) * image.width + left) * 4;
    const dstStart = y * width * 4;
    image.data.copy(data, dstStart, srcStart, srcStart + width * 4);
  }

  return { data, width, height };
}

export function validateRegion(region: Region, label: string): void {
  for (const key of ["left", "top", "width", "height"] as const) {
    if (!Number.isFinite(region[key])) {
      throw new OcrError("OCR_INVALID_ARGUMENT", `${label}.${key} must be a finite number`, {
        context: { label: `${label}.${key}`, value: region[key] },
      });
    }
  }
  if (region.width <= 0) {
    throw new OcrError("OCR_INVALID_ARGUMENT", `${label}.width must be > 0`, {
      context: { label: `${label}.width`, value: region.width },
    });
  }
  if (region.height <= 0) {
    throw new OcrError("OCR_INVALID_ARGUMENT", `${label}.height must be > 0`, {
      context: { label: `${label}.height`, value: region.height },
    });
  }
}

export function validateCaptureImage(image: CaptureImage, label: string): CaptureImage {
  if (!Number.isFinite(image.width) || image.width <= 0) {
    throw new OcrError("OCR_IMAGE_INVALID", `${label}.width must be a positive finite number`, {
      context: { label: `${label}.width`, width: image.width },
    });
  }
  if (!Number.isFinite(image.height) || image.height <= 0) {
    throw new OcrError("OCR_IMAGE_INVALID", `${label}.height must be a positive finite number`, {
      context: { label: `${label}.height`, height: image.height },
    });
  }
  const expected = image.width * image.height * 4;
  if (!Number.isSafeInteger(expected) || image.data.length !== expected) {
    throw new OcrError(
      "OCR_IMAGE_INVALID",
      `${label} RGBA data length must equal width * height * 4`,
      {
        context: {
          label,
          width: image.width,
          height: image.height,
          expectedBytes: expected,
          actualBytes: image.data.length,
        },
      }
    );
  }
  return image;
}

export async function decodeImage(bytes: Buffer): Promise<CaptureImage> {
  return validateCaptureImage(coreImage.decode(bytes), "image");
}

function imageSummary(image: CaptureImage): Record<string, number> {
  return {
    width: image.width,
    height: image.height,
    bytes: image.data.length,
  };
}

export async function resizeRgba(
  image: CaptureImage,
  width: number,
  height: number
): Promise<CaptureImage> {
  validateCaptureImage(image, "image");
  const sharp = await import("sharp");
  const { data, info } = await sharp
    .default(image.data, {
      raw: {
        width: image.width,
        height: image.height,
        channels: 4,
      },
    })
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function preprocessImage(
  image: CaptureImage,
  options?: OcrPreprocessOptions | boolean
): Promise<CaptureImage> {
  validateCaptureImage(image, "image");
  if (!options) return image;
  const cfg = options === true ? defaultPreprocessOptions() : options;
  const scale = cfg.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) {
    throw new OcrError("OCR_INVALID_ARGUMENT", "preprocess.scale must be > 0 and <= 8", {
      context: { label: "preprocess.scale", value: scale },
    });
  }

  const needsSharp =
    cfg.grayscale ||
    cfg.normalize ||
    cfg.sharpen ||
    scale !== 1;
  if (!needsSharp) return image;

  const sharp = await import("sharp");
  let pipeline = sharp.default(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: 4,
    },
  });

  if (scale !== 1) {
    pipeline = pipeline.resize(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
      { fit: "fill", kernel: "lanczos3" }
    );
  }
  if (cfg.grayscale) pipeline = pipeline.grayscale();
  if (cfg.normalize) pipeline = pipeline.normalize();
  if (cfg.sharpen) pipeline = pipeline.sharpen();

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: ensureRgba(data, info.width, info.height, info.channels),
    width: info.width,
    height: info.height,
  };
}

function defaultPreprocessOptions(): OcrPreprocessOptions {
  return {
    grayscale: true,
    normalize: true,
    sharpen: true,
    scale: 2,
  };
}

function ensureRgba(data: Buffer, width: number, height: number, channels: number): Buffer {
  if (channels === 4) return data;

  const pixels = width * height;
  const out = Buffer.alloc(pixels * 4);
  for (let i = 0; i < pixels; i++) {
    const src = i * channels;
    const dst = i * 4;
    if (channels === 1) {
      const v = data[src];
      out[dst] = v;
      out[dst + 1] = v;
      out[dst + 2] = v;
      out[dst + 3] = 255;
    } else {
      out[dst] = data[src];
      out[dst + 1] = data[src + 1] ?? data[src];
      out[dst + 2] = data[src + 2] ?? data[src];
      out[dst + 3] = channels >= 4 ? data[src + 3] : 255;
    }
  }
  return out;
}
