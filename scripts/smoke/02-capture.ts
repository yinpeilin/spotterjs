import * as path from "path";
import { screen } from "@spotter/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { writeRgbaPng } from "../lib/png";

export async function run(): Promise<void> {
  const img = screen.capture();
  const expected = img.width * img.height * 4;
  if (img.data.length !== expected) {
    throw new Error(
      `capture buffer size ${img.data.length} !== ${expected} (${img.width}x${img.height})`
    );
  }
  info(`captured ${img.width}x${img.height} (${img.data.length} bytes)`);

  const outDir = ensureOutputDir();
  const outPath = path.join(outDir, "capture.png");
  writeRgbaPng(outPath, img.width, img.height, img.data);
  info(`wrote ${outPath}`);
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("02-capture") ?? false;

if (isDirect) {
  void runSmokeScript("02-capture", run);
}
