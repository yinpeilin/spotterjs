import { run as openFocus } from "./01-open-focus";
import { run as captureWindow } from "./02-capture-window";
import { run as matchTool } from "./03-match-tool";
import { run as clickTool } from "./04-click-tool";
import { run as keyboardMouse } from "./05-keyboard-mouse";
import { run as uiTreeDump } from "./06-ui-tree-dump";
import { run as uiTreeQuery } from "./07-ui-tree-query";

const STEPS: Array<{ name: string; run: () => Promise<void> }> = [
  { name: "01-open-focus", run: openFocus },
  { name: "02-capture-window", run: captureWindow },
  { name: "03-match-tool", run: matchTool },
  { name: "04-click-tool", run: clickTool },
  { name: "05-keyboard-mouse", run: keyboardMouse },
  { name: "06-ui-tree-dump", run: uiTreeDump },
  { name: "07-ui-tree-query", run: uiTreeQuery },
];

async function main(): Promise<void> {
  console.log("spotterjs Paint examples\n");

  for (const step of STEPS) {
    console.log(`[RUN] ${step.name}`);
    await step.run();
    console.log(`[PASS] ${step.name}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
