import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fail, getOutputDir, pass } from "../lib/log";
import { run as run01 } from "./01-version-screen";
import { run as run02 } from "./02-capture";
import { run as run03 } from "./03-clipboard";
import { run as run04 } from "./04-windows";
import { run as run05 } from "./05-match-self";

const SCRIPTS: Array<{ name: string; run: () => Promise<void> }> = [
  { name: "01-version-screen", run: run01 },
  { name: "02-capture", run: run02 },
  { name: "03-clipboard", run: run03 },
  { name: "04-windows", run: run04 },
  { name: "05-match-self", run: run05 },
];

function tryOpencvBenchmark(): void {
  const pluginRoot = path.resolve(
    process.cwd(),
    "packages/plugin-match-opencv"
  );
  const distBench = path.join(
    pluginRoot,
    "dist/benchmark/compare-matchers.js"
  );
  if (!fs.existsSync(distBench)) {
    console.log("[SKIP] OpenCV benchmark — plugin not built");
    return;
  }

  const outDir = getOutputDir();
  const capture = path.join(outDir, "capture.png");
  const needle = path.join(outDir, "needle.png");
  if (!fs.existsSync(capture) || !fs.existsSync(needle)) {
    console.log("[SKIP] OpenCV benchmark — no test-output fixtures");
    return;
  }

  const fixturesDir = path.join(pluginRoot, "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.copyFileSync(capture, path.join(fixturesDir, "screen.png"));
  fs.copyFileSync(needle, path.join(fixturesDir, "needle.png"));

  try {
    console.log("[INFO] OpenCV benchmark (optional)…");
    execSync("npm run benchmark --workspace=@spotter/plugin-match-opencv", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch {
    console.log("[SKIP] OpenCV benchmark failed (native may be missing)");
  }
}

async function main(): Promise<void> {
  console.log("Spotter smoke tests\n");
  let failed = 0;

  for (const { name, run } of SCRIPTS) {
    try {
      await run();
      pass(name);
    } catch (err) {
      fail(name, err);
      failed++;
    }
  }

  console.log("");
  tryOpencvBenchmark();

  if (failed > 0) {
    console.error(`\n${failed} smoke test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
