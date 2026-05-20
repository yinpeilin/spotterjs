import * as fs from "fs";
import { PNG } from "pngjs";

export function cropRgba(
  src: Buffer,
  screenWidth: number,
  screenHeight: number,
  left: number,
  top: number,
  width: number,
  height: number
): Buffer {
  if (left + width > screenWidth || top + height > screenHeight) {
    throw new Error(
      `crop out of bounds: (${left},${top}) ${width}x${height} in ${screenWidth}x${screenHeight}`
    );
  }
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = ((top + y) * screenWidth + (left + x)) * 4;
      const oi = (y * width + x) * 4;
      src.copy(out, oi, si, si + 4);
    }
  }
  return out;
}

export function writeRgbaPng(
  filePath: string,
  width: number,
  height: number,
  data: Buffer
): void {
  const expected = width * height * 4;
  if (data.length !== expected) {
    throw new Error(
      `RGBA length mismatch: got ${data.length}, expected ${expected}`
    );
  }
  const png = new PNG({ width, height });
  data.copy(png.data);
  const bytes = PNG.sync.write(png);
  fs.writeFileSync(filePath, bytes);
}

export function drawCrosshair(
  data: Buffer,
  imgW: number,
  imgH: number,
  x: number,
  y: number,
  color: readonly [number, number, number] = [0, 255, 0],
  size = 8
): void {
  for (let d = -size; d <= size; d++) {
    const px = x + d;
    const py = y + d;
    if (px >= 0 && px < imgW) {
      const i = (y * imgW + px) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
    if (py >= 0 && py < imgH) {
      const i = (py * imgW + x) * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  }
}

export function drawRectOutline(
  data: Buffer,
  imgW: number,
  imgH: number,
  r: { left: number; top: number; width: number; height: number },
  color: readonly [number, number, number] = [255, 0, 0],
  thickness = 2
): void {
  const x0 = Math.max(0, r.left);
  const y0 = Math.max(0, r.top);
  const x1 = Math.min(imgW - 1, r.left + r.width - 1);
  const y1 = Math.min(imgH - 1, r.top + r.height - 1);
  for (let t = 0; t < thickness; t++) {
    for (let x = x0; x <= x1; x++) {
      for (const y of [y0 + t, y1 - t]) {
        if (y < 0 || y >= imgH) continue;
        const i = (y * imgW + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (const x of [x0 + t, x1 - t]) {
        if (x < 0 || x >= imgW) continue;
        const i = (y * imgW + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
      }
    }
  }
}
