import { pass } from "../lib/log";
import { run as run01 } from "./01-version-screen";
import { run as run02 } from "./02-capture";
import { run as run03 } from "./03-clipboard";
import { run as run04 } from "./04-windows";
import { run as run05 } from "./05-match-self";
import { run as run07 } from "./07-desktop-apps";
import { run as runOcr } from "./ocr-synthetic";

const SCRIPTS: Array<{ name: string; run: () => Promise<void> }> = [
  { name: "01-version-screen", run: run01 },
  { name: "02-capture", run: run02 },
  { name: "03-clipboard", run: run03 },
  { name: "04-windows", run: run04 },
  { name: "05-match-self", run: run05 },
  { name: "07-desktop-apps", run: run07 },
  { name: "ocr-synthetic", run: runOcr },
];

export async function run(): Promise<void> {
  console.log("spotterjs noninteractive smoke tests\n");
  let failed = 0;

  for (const { name, run: runScript } of SCRIPTS) {
    try {
      await runScript();
      pass(name);
    } catch (err) {
      reportFailure(name, err);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} smoke test(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll noninteractive smoke tests passed.");
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("run-noninteractive") ?? false;

if (isDirect) {
  void run();
}

function reportFailure(name: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[FAIL] ${name} - ${msg}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}
