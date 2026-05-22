/**
 * 快速探测：微信窗口截图 + 联系人模板匹配（不写消息）。
 * npm run integration:wechat:probe
 */
import * as path from "path";
import { findAllInWindow, findInWindow, loadNative, windowApi } from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { writeRgbaPng } from "../lib/png";
import {
  contactListRegion,
  DEFAULT_CONTACT_TEMPLATE,
  findWechatWindow,
} from "./lib/wechat-contact";

export async function run(): Promise<void> {
  const win = findWechatWindow();
  if (!win) throw new Error("未找到微信窗口");

  windowApi.focus(win.id);
  await new Promise((r) => setTimeout(r, 400));

  const native = loadNative();
  const cap = native.captureWindow(win.id);
  const out = path.join(ensureOutputDir(), "wechat-window-capture.png");
  writeRgbaPng(out, cap.width, cap.height, Buffer.from(cap.data));
  info(`截图: ${out} (${cap.width}x${cap.height})`);

  const listRegion = contactListRegion(win);
  info(`搜索区域(窗口内): ${JSON.stringify(listRegion)}`);

  for (const conf of [0.85, 0.75, 0.70, 0.65, 0.55]) {
    const hits = findAllInWindow(win.id, DEFAULT_CONTACT_TEMPLATE, {
      confidence: conf,
      searchRegion: listRegion,
      multiScale: false,
    });
    info(`findAll conf=${conf} → ${hits.length} 处`);
    for (const [i, h] of hits.slice(0, 5).entries()) {
      const lx = h.left - win.region.left;
      const ly = h.top - win.region.top;
      info(`  [${i}] 窗口内 left=${lx} top=${ly} ${h.width}x${h.height}`);
    }
    try {
      const one = findInWindow(win.id, DEFAULT_CONTACT_TEMPLATE, {
        confidence: conf,
        searchRegion: listRegion,
        multiScale: false,
      });
      info(
        `findInWindow conf=${conf} → (${one.left - win.region.left},${one.top - win.region.top})`
      );
    } catch {
      info(`findInWindow conf=${conf} → 未命中`);
    }
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("wechat-probe-match") ??
  false;
if (isDirect) {
  void runSmokeScript("wechat-probe-match", run);
}
