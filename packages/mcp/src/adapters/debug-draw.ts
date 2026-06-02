import type { CaptureImage, Point, Region } from "@spotterjs/base";
import { image } from "@spotterjs/core";
import {
  type CaptureArtifact,
  workspaceImageStore,
} from "./artifacts.js";

type Rgba = [number, number, number, number];

export type DebugAnnotation =
  | { kind: "region"; region: Region; color?: Rgba }
  | { kind: "polygon"; points: Point[]; color?: Rgba }
  | { kind: "point"; point: Point; color?: Rgba };

export type WriteDebugOptions = {
  prefix: string;
  origin?: Point;
};

const COLORS = {
  region: [0, 204, 102, 255] as Rgba,
  polygon: [0, 153, 255, 255] as Rgba,
  point: [255, 64, 64, 255] as Rgba,
};

export function annotateCapture(
  source: CaptureImage,
  annotations: DebugAnnotation[]
): CaptureImage {
  const output: CaptureImage = {
    width: source.width,
    height: source.height,
    data: Buffer.from(source.data),
  };

  for (const annotation of annotations) {
    if (annotation.kind === "region") {
      drawRegion(output, annotation.region, annotation.color ?? COLORS.region);
    } else if (annotation.kind === "polygon") {
      drawPolygon(output, annotation.points, annotation.color ?? COLORS.polygon);
    } else {
      drawPoint(output, annotation.point, annotation.color ?? COLORS.point);
    }
  }

  return output;
}

export function writeDebugCapture(
  capture: CaptureImage,
  annotations: DebugAnnotation[],
  options: WriteDebugOptions
): CaptureArtifact {
  return workspaceImageStore.writeCapture(annotateCapture(capture, annotations), {
    prefix: options.prefix,
    detail: "original",
  });
}

export function writeDebugImageFromPath(
  imagePath: string,
  annotations: DebugAnnotation[],
  options: WriteDebugOptions
): CaptureArtifact {
  const capture = image.read(imagePath);
  return writeDebugCapture(
    capture,
    translateAnnotations(annotations, options.origin ?? { x: 0, y: 0 }),
    options
  );
}

function translateAnnotations(
  annotations: DebugAnnotation[],
  origin: Point
): DebugAnnotation[] {
  if (origin.x === 0 && origin.y === 0) return annotations;
  return annotations.map((annotation) => {
    if (annotation.kind === "region") {
      return {
        ...annotation,
        region: translateRegion(annotation.region, origin),
      };
    }
    if (annotation.kind === "polygon") {
      return {
        ...annotation,
        points: annotation.points.map((point) => translatePoint(point, origin)),
      };
    }
    return {
      ...annotation,
      point: translatePoint(annotation.point, origin),
    };
  });
}

function translateRegion(region: Region, origin: Point): Region {
  return {
    left: region.left - origin.x,
    top: region.top - origin.y,
    width: region.width,
    height: region.height,
  };
}

function translatePoint(point: Point, origin: Point): Point {
  return {
    x: point.x - origin.x,
    y: point.y - origin.y,
  };
}

function drawRegion(image: CaptureImage, region: Region, color: Rgba): void {
  const left = Math.round(region.left);
  const top = Math.round(region.top);
  const right = Math.round(region.left + region.width - 1);
  const bottom = Math.round(region.top + region.height - 1);
  drawLine(image, { x: left, y: top }, { x: right, y: top }, color);
  drawLine(image, { x: right, y: top }, { x: right, y: bottom }, color);
  drawLine(image, { x: right, y: bottom }, { x: left, y: bottom }, color);
  drawLine(image, { x: left, y: bottom }, { x: left, y: top }, color);
}

function drawPolygon(image: CaptureImage, points: Point[], color: Rgba): void {
  if (points.length < 2) return;
  for (let i = 0; i < points.length; i++) {
    drawLine(image, points[i]!, points[(i + 1) % points.length]!, color);
  }
}

function drawPoint(image: CaptureImage, point: Point, color: Rgba): void {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const radius = 6;
  drawLine(image, { x: x - radius, y }, { x: x + radius, y }, color);
  drawLine(image, { x, y: y - radius }, { x, y: y + radius }, color);
  drawRegion(image, { left: x - 2, top: y - 2, width: 5, height: 5 }, color);
}

function drawLine(
  image: CaptureImage,
  start: Point,
  end: Point,
  color: Rgba
): void {
  let x0 = Math.round(start.x);
  let y0 = Math.round(start.y);
  const x1 = Math.round(end.x);
  const y1 = Math.round(end.y);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    setPixel(image, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function setPixel(image: CaptureImage, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = color[3];
}
