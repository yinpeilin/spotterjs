import * as fs from "fs";
import type { CaptureImage, Region } from "@spotterjs/base";
import type { OcrImage } from "./types";

export async function loadImage(image: OcrImage): Promise<CaptureImage> {
  if (typeof image === "string") {
    return decodeImage(fs.readFileSync(image));
  }

  if (Buffer.isBuffer(image)) {
    return decodeImage(image);
  }

  return {
    data: Buffer.from(image.data),
    width: image.width,
    height: image.height,
  };
}

export function cropImage(image: CaptureImage, region?: Region): CaptureImage {
  if (!region) return image;

  const left = Math.max(0, region.left);
  const top = Math.max(0, region.top);
  const right = Math.min(image.width, region.left + region.width);
  const bottom = Math.min(image.height, region.top + region.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const srcStart = ((top + y) * image.width + left) * 4;
    const dstStart = y * width * 4;
    image.data.copy(data, dstStart, srcStart, srcStart + width * 4);
  }

  return { data, width, height };
}

export async function decodeImage(bytes: Buffer): Promise<CaptureImage> {
  const sharp = await import("sharp");
  const { data, info } = await sharp
    .default(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function resizeRgba(
  image: CaptureImage,
  width: number,
  height: number
): Promise<CaptureImage> {
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
