import * as path from "path";
import { loadNative, screen } from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { cropRgba, drawRectOutline, writeRgbaPng } from "../lib/png";

const PREFERRED_CROP_LEFT = 100;
const PREFERRED_CROP_TOP = 100;
const CROP_WIDTH = 32;
const CROP_HEIGHT = 32;
const CONFIDENCE = 0.85;
const MAX_OFFSET_PX = 2;
const MIN_TEXTURE_SCORE = 18;

type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function textureScore(
  data: Buffer,
  imgWidth: number,
  left: number,
  top: number,
  width: number,
  height: number
): number {
  let min = 255;
  let max = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = ((top + y) * imgWidth + left + x) * 4;
      const luma = Math.round(
        data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      );
      min = Math.min(min, luma);
      max = Math.max(max, luma);
    }
  }

  return max - min;
}

function chooseCrop(full: {
  data: Buffer;
  width: number;
  height: number;
}): CropRegion {
  if (full.width < CROP_WIDTH || full.height < CROP_HEIGHT) {
    throw new Error(
      `screen too small for ${CROP_WIDTH}x${CROP_HEIGHT} crop: ${full.width}x${full.height}`
    );
  }

  const preferred = {
    left: Math.min(PREFERRED_CROP_LEFT, full.width - CROP_WIDTH),
    top: Math.min(PREFERRED_CROP_TOP, full.height - CROP_HEIGHT),
    width: CROP_WIDTH,
    height: CROP_HEIGHT,
  };
  let best = preferred;
  let bestScore = textureScore(
    full.data,
    full.width,
    preferred.left,
    preferred.top,
    CROP_WIDTH,
    CROP_HEIGHT
  );

  const stepX = Math.max(CROP_WIDTH, Math.floor(full.width / 8));
  const stepY = Math.max(CROP_HEIGHT, Math.floor(full.height / 6));
  for (let top = 0; top <= full.height - CROP_HEIGHT; top += stepY) {
    for (let left = 0; left <= full.width - CROP_WIDTH; left += stepX) {
      const score = textureScore(
        full.data,
        full.width,
        left,
        top,
        CROP_WIDTH,
        CROP_HEIGHT
      );
      if (score > bestScore) {
        best = { left, top, width: CROP_WIDTH, height: CROP_HEIGHT };
        bestScore = score;
      }
      if (bestScore >= MIN_TEXTURE_SCORE) {
        return best;
      }
    }
  }

  return best;
}

function expandedSearchRegion(
  crop: CropRegion,
  screenWidth: number,
  screenHeight: number
): CropRegion {
  const left = Math.max(0, crop.left - MAX_OFFSET_PX);
  const top = Math.max(0, crop.top - MAX_OFFSET_PX);
  const right = Math.min(
    screenWidth,
    crop.left + crop.width + MAX_OFFSET_PX
  );
  const bottom = Math.min(
    screenHeight,
    crop.top + crop.height + MAX_OFFSET_PX
  );

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function assertCloseMatch(
  label: string,
  found: CropRegion,
  expected: CropRegion
): void {
  const dx = Math.abs(found.left - expected.left);
  const dy = Math.abs(found.top - expected.top);
  if (dx > MAX_OFFSET_PX || dy > MAX_OFFSET_PX) {
    throw new Error(
      `${label} offset too large: expected ~(${expected.left},${expected.top}), got (${found.left},${found.top}), delta (${dx},${dy})`
    );
  }
}

export async function run(): Promise<void> {
  const full = screen.capture();

  const crop = chooseCrop(full);
  const searchRegion = expandedSearchRegion(crop, full.width, full.height);

  const needleData = cropRgba(
    full.data,
    full.width,
    full.height,
    crop.left,
    crop.top,
    crop.width,
    crop.height
  );

  const outDir = ensureOutputDir();
  const needlePath = path.join(outDir, "needle.png");
  writeRgbaPng(needlePath, crop.width, crop.height, needleData);

  const annotated = Buffer.from(full.data);
  drawRectOutline(annotated, full.width, full.height, crop);
  writeRgbaPng(
    path.join(outDir, "match-self-source.png"),
    full.width,
    full.height,
    annotated
  );

  // Use the captured image for matching so live screen changes cannot affect this smoke.
  const native = loadNative();
  const match = native.findTemplateBuffers(
    { data: full.data, width: full.width, height: full.height },
    { data: needleData, width: crop.width, height: crop.height },
    {
      confidence: CONFIDENCE,
      searchRegion,
    }
  );

  const found = match.region;
  if (!Number.isFinite(match.score)) {
    throw new Error(`findTemplateBuffers returned invalid score: ${match.score}`);
  }
  info(`full screen ${full.width}x${full.height}`);
  info(
    `crop (${crop.left},${crop.top}) ${crop.width}x${crop.height}; search (${searchRegion.left},${searchRegion.top}) ${searchRegion.width}x${searchRegion.height}`
  );
  info(`wrote needle ${needlePath}`);
  info(
    `buffer match at (${found.left},${found.top}) ${found.width}x${found.height} score=${match.score.toFixed(4)}`
  );
  assertCloseMatch("buffer match", found, crop);

  const allMatches = native.findAllTemplateBuffers(
    { data: full.data, width: full.width, height: full.height },
    { data: needleData, width: crop.width, height: crop.height },
    {
      confidence: CONFIDENCE,
      searchRegion,
    }
  );
  if (allMatches.length === 0) {
    throw new Error("findAllTemplateBuffers returned no matches");
  }
  info(`findAllTemplateBuffers returned ${allMatches.length} match(es)`);
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("05-match-self") ?? false;

if (isDirect) {
  void runSmokeScript("05-match-self", run);
}
