import { accessibility, type A11yQuery } from "@spotterjs/core";
import { ensurePaintWindow, info } from "./lib/paint";
import { attachPaintTree, formatElementInfo } from "./lib/ui-tree";

const QUERY_CANDIDATES: Array<{ label: string; query: A11yQuery }> = [
  { label: "File menu", query: { name: "File", controlType: "MenuItem" } },
  { label: "localized File menu", query: { name: "文件", controlType: "MenuItem" } },
  { label: "first button", query: { controlType: "Button" } },
  { label: "first menu item", query: { controlType: "MenuItem" } },
];

function findFirst(rootId: string): { label: string; elementId: string } {
  const failures: string[] = [];

  for (const candidate of QUERY_CANDIDATES) {
    try {
      return {
        label: candidate.label,
        elementId: accessibility.find(rootId, candidate.query, 8),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${candidate.label}: ${message}`);
    }
  }

  throw new Error(`No query candidate matched Paint UI tree.\n${failures.join("\n")}`);
}

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  const session = attachPaintTree(win);
  const found = findFirst(session.rootId);
  const element = accessibility.debug.getElementInfo(found.elementId);

  info(`query matched ${found.label} elementId=${found.elementId}`);
  info(formatElementInfo(element));

  if (process.env.SPOTTERJS_PAINT_UIA_CLICK === "1") {
    const bounds = accessibility.click(found.elementId);
    info(
      `clicked center of bounds (${bounds.left},${bounds.top}) ${bounds.width}x${bounds.height}`
    );
  } else {
    info("set SPOTTERJS_PAINT_UIA_CLICK=1 to also click the matched UIA element");
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("07-ui-tree-query") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
