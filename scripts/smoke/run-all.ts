import { fail, pass } from "../lib/log";
import { run as run01 } from "./01-version-screen";
import { run as run02 } from "./02-capture";
import { run as run03 } from "./03-clipboard";
import { run as run04 } from "./04-windows";
import { run as run05 } from "./05-match-self";
import { run as run08 } from "./08-match-tap-coords";

const SCRIPTS: Array<{ name: string; run: () => Promise<void> }> = [
  { name: "01-version-screen", run: run01 },
  { name: "02-capture", run: run02 },
  { name: "03-clipboard", run: run03 },
  { name: "04-windows", run: run04 },
  { name: "05-match-self", run: run05 },
  { name: "08-match-tap-coords", run: run08 },
];

async function main(): Promise<void> {
  console.log("spotterjs smoke tests\n");
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
