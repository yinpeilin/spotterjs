/**
 * Compare NCC vs OpenCV matchers on the same fixture paths.
 * Place screen.png + needle.png under packages/plugin-match-opencv/fixtures/
 */
import * as fs from "fs";
import * as path from "path";
import { createNccMatchProvider } from "@spotter/core";
import { createOpencvMatchProvider } from "../index";

const fixturesDir = path.join(__dirname, "..", "..", "fixtures");

async function bench(name: string, fn: () => Promise<unknown>) {
  const t0 = performance.now();
  let ok = true;
  let result: unknown;
  try {
    result = await fn();
  } catch (e) {
    ok = false;
    result = e instanceof Error ? e.message : String(e);
  }
  return { name, ok, ms: Math.round(performance.now() - t0), result };
}

async function main() {
  const screenPath = path.join(fixturesDir, "screen.png");
  const needlePath = path.join(fixturesDir, "needle.png");

  if (!fs.existsSync(screenPath) || !fs.existsSync(needlePath)) {
    console.log(
      "Skip: add fixtures/screen.png and fixtures/needle.png for benchmark."
    );
    return;
  }

  const opts = { confidence: 0.8 };
  const ncc = createNccMatchProvider();

  const rows = [await bench("NCC find", () => ncc.find(needlePath, opts))];

  try {
    const opencv = createOpencvMatchProvider({ multiScale: false });
    rows.push(await bench("OpenCV find", () => opencv.find(needlePath, opts)));
  } catch (e) {
    rows.push({
      name: "OpenCV find",
      ok: false,
      ms: 0,
      result: `native not built: ${e}`,
    });
  }

  console.table(rows);
}

main().catch(console.error);
