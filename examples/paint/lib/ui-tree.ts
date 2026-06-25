import * as fs from "fs";
import {
  accessibility,
  type AttachReport,
  type ElementInfo,
  type TreeHealth,
  type TreeNodeDump,
  type TreeViewMode,
  type WindowInfo,
} from "@spotterjs/core";
import { info, paintOutputPath } from "./paint";

const DEFAULT_TREE_VIEW: TreeViewMode = "control";
const DEFAULT_ATTACH_DEPTH = 8;

type TreeSummary = {
  totalNodes: number;
  visibleNodes: number;
  buttonNodes: number;
  editNodes: number;
};

export type PaintTreeSession = {
  rootId: string;
  report: AttachReport;
  health: TreeHealth;
  treeView: TreeViewMode;
};

function parseTreeView(value: string | undefined): TreeViewMode {
  if (value === "auto" || value === "raw" || value === "control" || value === "content") {
    return value;
  }
  return DEFAULT_TREE_VIEW;
}

export function paintTreeView(): TreeViewMode {
  return parseTreeView(process.env.SPOTTERJS_PAINT_TREE_VIEW);
}

export function enablePaintAccessibility(treeView = paintTreeView()): void {
  accessibility.enable({
    attachDelayMs: 300,
    eventSubscription: false,
    treeWaitTimeoutMs: 5_000,
    treeWaitPollMs: 200,
    treeView,
  });
}

export function attachPaintTree(
  win: WindowInfo,
  maxDepth = DEFAULT_ATTACH_DEPTH
): PaintTreeSession {
  const treeView = paintTreeView();
  enablePaintAccessibility(treeView);

  const report = accessibility.debug.attachWindowReport(win.id, maxDepth);
  const attachedTreeView = parseTreeView(report.treeView);
  const health = accessibility.debug.treeHealth(
    report.elementId,
    maxDepth,
    attachedTreeView
  );

  info(
    `ui tree attached root=${report.elementId} strategy=${report.attachStrategy} treeView=${attachedTreeView}`
  );
  info(
    `ui tree nodes=${health.totalNodes} buttons=${health.buttonCount} edits=${health.editCount} listItems=${health.listItemCount}`
  );

  if (health.totalNodes < 1) {
    throw new Error("Paint UI tree is empty. Check Windows UI Automation support.");
  }

  return {
    rootId: report.elementId,
    report,
    health,
    treeView: attachedTreeView,
  };
}

export function writePaintTreeDump(
  rootId: string,
  treeView: TreeViewMode,
  maxDepth = 5
): { textPath: string; objectPath: string; tree: TreeNodeDump } {
  const text = accessibility.debug.dumpTree(rootId, { maxDepth, treeView });
  const tree = accessibility.debug.dumpTreeObject(rootId, { maxDepth, treeView });
  const textPath = paintOutputPath("paint-ui-tree.json");
  const objectPath = paintOutputPath("paint-ui-tree-object.json");

  fs.writeFileSync(textPath, text, "utf8");
  fs.writeFileSync(objectPath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");

  info(`wrote ${textPath}`);
  info(`wrote ${objectPath}`);

  return { textPath, objectPath, tree };
}

export function summarizeTree(node: TreeNodeDump): TreeSummary {
  const summary: TreeSummary = {
    totalNodes: 0,
    visibleNodes: 0,
    buttonNodes: 0,
    editNodes: 0,
  };
  const stack = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    summary.totalNodes += 1;
    if (!current.isOffscreen) summary.visibleNodes += 1;
    if (current.controlType === "Button") summary.buttonNodes += 1;
    if (current.controlType === "Edit") summary.editNodes += 1;

    for (const child of current.children ?? []) {
      stack.push(child);
    }
  }

  return summary;
}

export function formatElementInfo(element: ElementInfo): string {
  const bounds = element.bounds
    ? ` bounds=(${element.bounds.left},${element.bounds.top}) ${element.bounds.width}x${element.bounds.height}`
    : "";
  const name = element.name ? `"${element.name}"` : "(unnamed)";
  const automationId = element.automationId ? ` automationId=${element.automationId}` : "";
  return `${name} type=${element.controlType}${automationId}${bounds}`;
}
