import type { Point, Region } from "@spotterjs/base";

export type DetectedBox = {
  region: Region;
  box: [Point, Point, Point, Point];
  score: number;
};

export function decodeCtc(
  logits: number[][],
  dictionary: string[]
): { text: string; score: number } {
  const chars: string[] = [];
  let scoreSum = 0;
  let scoreCount = 0;
  let previous = -1;

  for (const row of logits) {
    let best = 0;
    for (let i = 1; i < row.length; i++) {
      if (row[i] > row[best]) best = i;
    }

    if (best !== 0 && best !== previous) {
      chars.push(dictionary[best - 1] ?? "");
      scoreSum += row[best];
      scoreCount++;
    }
    previous = best;
  }

  return {
    text: chars.join(""),
    score: scoreCount ? scoreSum / scoreCount : 0,
  };
}

export function boxesFromBitmap(
  bitmap: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number
): DetectedBox[] {
  const visited = new Uint8Array(width * height);
  const boxes: DetectedBox[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start] || bitmap[start] < threshold) continue;

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let sum = 0;
      let count = 0;
      const points: Point[] = [];
      const queue: number[] = [start];
      let head = 0;
      visited[start] = 1;
      const enqueueNeighbor = (nx: number, ny: number): void => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const nidx = ny * width + nx;
        if (visited[nidx] || bitmap[nidx] < threshold) return;
        visited[nidx] = 1;
        queue.push(nidx);
      };

      while (head < queue.length) {
        const idx = queue[head++];
        const px = idx % width;
        const py = Math.floor(idx / width);
        const score = bitmap[idx];

        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
        sum += score;
        count++;
        points.push({ x: px + 0.5, y: py + 0.5 });

        enqueueNeighbor(px - 1, py);
        enqueueNeighbor(px + 1, py);
        enqueueNeighbor(px, py - 1);
        enqueueNeighbor(px, py + 1);
      }

      const region = {
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
      const rotatedBox = rotatedBoxFromPoints(points);
      boxes.push({
        region,
        box: rotatedBox ?? rectToBox(region),
        score: sum / count,
      });
    }
  }

  return boxes.sort((a, b) => a.region.top - b.region.top || a.region.left - b.region.left);
}

function rotatedBoxFromPoints(points: Point[]): [Point, Point, Point, Point] | undefined {
  if (points.length < 2) return undefined;

  const pcaBox = pcaOrientedBox(points);
  if (pcaBox) return pcaBox;

  const hull = convexHull(points);
  if (hull.length < 2) return undefined;

  const rect = minimumAreaRect(hull);
  if (!rect) return undefined;

  const box = orderBox(unclipBox(rect).map(roundPoint));
  return uniquePointCount(box) >= 4 ? box : undefined;
}

function pcaOrientedBox(points: Point[]): [Point, Point, Point, Point] | undefined {
  const center = polygonCenter(points);
  let xx = 0;
  let xy = 0;
  let yy = 0;

  for (const point of points) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }

  const angle = Math.atan2(2 * xy, xx - yy) / 2;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = -uy;
  const vy = ux;
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const u = dx * ux + dy * uy;
    const v = dx * vx + dy * vy;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  const major = maxU - minU;
  const minor = maxV - minV;
  const normalizedAngle = Math.abs(Math.atan2(uy, ux));
  const nearAxis =
    normalizedAngle < Math.PI / 24 || Math.abs(normalizedAngle - Math.PI / 2) < Math.PI / 24;
  if (major / Math.max(1, minor) < 1.2 || nearAxis) return undefined;

  const corners = [
    fromCenteredAxes(minU, minV, center, ux, uy, vx, vy),
    fromCenteredAxes(maxU, minV, center, ux, uy, vx, vy),
    fromCenteredAxes(maxU, maxV, center, ux, uy, vx, vy),
    fromCenteredAxes(minU, maxV, center, ux, uy, vx, vy),
  ];
  const box = orderBox(unclipBox(corners).map(roundPoint));
  return uniquePointCount(box) >= 4 ? box : undefined;
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [];
  const upper: Point[] = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function minimumAreaRect(points: Point[]): Point[] | undefined {
  if (points.length === 2) {
    return lineRect(points[0], points[1]);
  }

  let best: { area: number; corners: Point[] } | undefined;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    const ux = dx / len;
    const uy = dy / len;
    const vx = -uy;
    const vy = ux;
    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      const u = point.x * ux + point.y * uy;
      const v = point.x * vx + point.y * vy;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      best = {
        area,
        corners: [
          fromAxes(minU, minV, ux, uy, vx, vy),
          fromAxes(maxU, minV, ux, uy, vx, vy),
          fromAxes(maxU, maxV, ux, uy, vx, vy),
          fromAxes(minU, maxV, ux, uy, vx, vy),
        ],
      };
    }
  }

  return best?.corners;
}

function lineRect(a: Point, b: Point): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len / 2;
  const py = dx / len / 2;

  return [
    { x: a.x + px, y: a.y + py },
    { x: b.x + px, y: b.y + py },
    { x: b.x - px, y: b.y - py },
    { x: a.x - px, y: a.y - py },
  ];
}

function unclipBox(box: Point[]): Point[] {
  const center = polygonCenter(box);
  return box.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / len) * 0.7,
      y: point.y + (dy / len) * 0.7,
    };
  });
}

function orderBox(points: Point[]): [Point, Point, Point, Point] {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.x - a.y - (b.x - b.y));
  return [bySum[0], byDiff[points.length - 1], bySum[points.length - 1], byDiff[0]];
}

function fromAxes(u: number, v: number, ux: number, uy: number, vx: number, vy: number): Point {
  return {
    x: u * ux + v * vx,
    y: u * uy + v * vy,
  };
}

function fromCenteredAxes(
  u: number,
  v: number,
  center: Point,
  ux: number,
  uy: number,
  vx: number,
  vy: number
): Point {
  return {
    x: center.x + u * ux + v * vx,
    y: center.y + u * uy + v * vy,
  };
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function polygonCenter(points: Point[]): Point {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function roundPoint(point: Point): Point {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function uniquePointCount(points: Point[]): number {
  return new Set(points.map((point) => `${point.x},${point.y}`)).size;
}

export function rectToBox(region: Region): [Point, Point, Point, Point] {
  const right = region.left + region.width;
  const bottom = region.top + region.height;
  return [
    { x: region.left, y: region.top },
    { x: right, y: region.top },
    { x: right, y: bottom },
    { x: region.left, y: bottom },
  ];
}

export function centerOf(region: Region): Point {
  return {
    x: region.left + Math.floor(region.width / 2),
    y: region.top + Math.floor(region.height / 2),
  };
}
