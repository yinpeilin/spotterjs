import * as path from "path";
import { screen } from "@spotter/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { cropRgba, writeRgbaPng } from "../lib/png";

const CROP_LEFT = 100;
const CROP_TOP = 100;
const CROP_WIDTH = 32;
const CROP_HEIGHT = 32;
const CONFIDENCE = 0.85;
const MAX_OFFSET_PX = 2;

export async function run(): Promise<void> {
  const full = screen.capture();
  info(`full screen ${full.width}x${full.height}`);

  if (
    CROP_LEFT + CROP_WIDTH > full.width ||
    CROP_TOP + CROP_HEIGHT > full.height
  ) {
    throw new Error(
      `crop region (${CROP_LEFT},${CROP_TOP}) ${CROP_WIDTH}x${CROP_HEIGHT} outside ${full.width}x${full.height}`
    );
  }

  const needleData = cropRgba(
    full.data,
    full.width,
    full.height,
    CROP_LEFT,
    CROP_TOP,
    CROP_WIDTH,
    CROP_HEIGHT
  );

  const outDir = ensureOutputDir();
  const needlePath = path.join(outDir, "needle.png");
  writeRgbaPng(needlePath, CROP_WIDTH, CROP_HEIGHT, needleData);
  info(`wrote needle ${needlePath}`);

  const found = await screen.find(needlePath, {
    confidence: CONFIDENCE,
    searchRegion: {
      left: CROP_LEFT - MAX_OFFSET_PX,
      top: CROP_TOP - MAX_OFFSET_PX,
      width: CROP_WIDTH + MAX_OFFSET_PX * 2,
      height: CROP_HEIGHT + MAX_OFFSET_PX * 2,
    },
  });
  info(
    `found at (${found.left},${found.top}) ${found.width}x${found.height}`
  );

  const dx = Math.abs(found.left - CROP_LEFT);
  const dy = Math.abs(found.top - CROP_TOP);
  if (dx > MAX_OFFSET_PX || dy > MAX_OFFSET_PX) {
    throw new Error(
      `match offset too large: expected ~(${CROP_LEFT},${CROP_TOP}), got (${found.left},${found.top}), delta (${dx},${dy})`
    );
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("05-match-self") ?? false;

if (isDirect) {
  void runSmokeScript("05-match-self", run);
}
