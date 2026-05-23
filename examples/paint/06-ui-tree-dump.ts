import { ensurePaintWindow, info } from "./lib/paint";
import {
  attachPaintTree,
  summarizeTree,
  writePaintTreeDump,
} from "./lib/ui-tree";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  const session = attachPaintTree(win);
  const { tree } = writePaintTreeDump(session.rootId, session.treeView);
  const summary = summarizeTree(tree);

  info(
    `dump summary nodes=${summary.totalNodes} visible=${summary.visibleNodes} buttons=${summary.buttonNodes} edits=${summary.editNodes}`
  );
  if (session.report.diagnosis.length > 0) {
    info(`diagnosis: ${session.report.diagnosis.join("; ")}`);
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("06-ui-tree-dump") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
