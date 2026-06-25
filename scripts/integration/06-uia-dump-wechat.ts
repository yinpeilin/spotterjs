/**
 * 微信 UIA 探测：启用客户端模式（StructureChanged 订阅 + 等待树展开），导出树与健康指标。
 * 完整发消息请用: npm run integration:wechat:send（键盘流程）。
 */
import * as fs from "fs";
import * as path from "path";
import { accessibility, windows } from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";

export async function run(): Promise<void> {
  const depth = 12;
  accessibility.enable({
    attachDelayMs: 800,
    eventSubscription: true,
    treeWaitTimeoutMs: 15_000,
    treeWaitPollMs: 300,
    minListItemCount: 1,
  });

  const win = findWechatWindow();
  info(`WeChat: "${win.title}" id=${win.id}`);
  windows.focus(win.id);
  await sleep(800);

  const report = accessibility.debug.attachWindowReport(win.id, depth);
  const root = report.elementId;

  info(`clientMode=${report.clientMode} handler=${report.eventHandlerRegistered}`);
  info(`attachStrategy=${report.attachStrategy} hwnd=${report.attachedHwnd} treeView=${report.treeView}`);
  info(
    `structureEvents=${report.structureChangedEvents} treeWaitMs=${report.treeWaitMs}`
  );
  if (report.candidates.length > 0) {
    info(`HWND candidates (${report.candidates.length}):`);
    for (const c of report.candidates) {
      info(
        `  hwnd=${c.hwnd} class=${c.className} nodes=${c.totalNodes} listItems=${c.listItemCount}${c.chosen ? " [chosen]" : ""}`
      );
    }
  }
  if (report.diagnosis.length > 0) {
    info(`diagnosis: ${report.diagnosis.join(", ")}`);
  }
  info(
    `health initial: nodes=${report.healthInitial.totalNodes} listItems=${report.healthInitial.listItemCount}`
  );
  info(
    `health final:   nodes=${report.healthFinal.totalNodes} listItems=${report.healthFinal.listItemCount} edits=${report.healthFinal.editCount} buttons=${report.healthFinal.buttonCount}`
  );

  const health = accessibility.debug.treeHealth(root, depth);
  const dumpHealth = countDumpNodes(JSON.parse(accessibility.debug.dumpTree(root, depth)));
  info(
    `health nodes=${health.totalNodes} dump nodes=${dumpHealth} (should match when treeView aligned)`
  );

  const outDir = ensureOutputDir();
  const reportPath = path.join(outDir, "wechat-uia-attach-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const dumpPath = path.join(outDir, "wechat-uia-tree.json");
  fs.writeFileSync(dumpPath, accessibility.debug.dumpTree(root, depth), "utf8");

  info(`dump nodes=${health.totalNodes} listItems=${health.listItemCount}`);
  info(`wrote ${reportPath}`);
  info(`wrote ${dumpPath}`);

  if (report.healthFinal.listItemCount < 1 && report.healthFinal.totalNodes < 10) {
    info(
      "warning: UIA 树仍较瘦。微信 4.1+ 可能需真实无障碍客户端或交互后才展开。发送请用: npm run integration:wechat:send"
    );
  } else {
    info("UIA 树已具备一定规模，可尝试 ListItem/Edit/Button 查询与 invoke/setValue");
  }
}

function findWechatWindow() {
  const allWindows = windows.list();
  const matches = allWindows.filter((w) => w.title.includes("微信"));
  if (matches.length === 0) {
    throw new Error('未找到标题含「微信」的窗口');
  }
  return matches.sort(
    (a, b) =>
      b.region.width * b.region.height - a.region.width * a.region.height
  )[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function countDumpNodes(node: { children?: unknown[] }): number {
  let n = 1;
  if (node.children) {
    for (const c of node.children) {
      n += countDumpNodes(c as { children?: unknown[] });
    }
  }
  return n;
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("06-uia-dump-wechat") ?? false;

if (isDirect) {
  void runSmokeScript("06-uia-dump-wechat", run);
}

