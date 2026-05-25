/**
 * Probe WeChat window capture + contact template matching without sending messages.
 * Run with: npm run integration:wechat:probe
 */
import * as path from "path";
import { loadNative } from "@spotterjs/core/native";
import { windows } from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { writeRgbaPng } from "../lib/png";
import {
  contactListRegion,
  DEFAULT_CONTACT_TEMPLATE,
  findWechatWindow,
} from "./lib/wechat-contact";

export async function run(): Promise<void> {
  const win = findWechatWindow();
  if (!win) throw new Error("WeChat window not found");

  windows.focus(win.id);
  await new Promise((r) => setTimeout(r, 400));

  const native = loadNative();
  const cap = native.captureWindow(win.id);
  const out = path.join(ensureOutputDir(), "wechat-window-capture.png");
  writeRgbaPng(out, cap.width, cap.height, Buffer.from(cap.data));
  info(`capture: ${out} (${cap.width}x${cap.height})`);

  const listRegion = contactListRegion(win);
  info(`search region (window-local): ${JSON.stringify(listRegion)}`);

  for (const conf of [0.85, 0.75, 0.7, 0.65, 0.55]) {
    const hits = windows.findAllTemplates(win.id, DEFAULT_CONTACT_TEMPLATE, {
      confidence: conf,
      region: listRegion,
      scale: false,
    });
    info(`findAll conf=${conf} -> ${hits.length} hits`);
    for (const [i, hit] of hits.slice(0, 5).entries()) {
      const r = hit.region;
      const lx = r.left - win.region.left;
      const ly = r.top - win.region.top;
      info(
        `  [${i}] local left=${lx} top=${ly} ${r.width}x${r.height} score=${hit.score.toFixed(4)}`
      );
    }
    try {
      const one = windows.findTemplate(win.id, DEFAULT_CONTACT_TEMPLATE, {
        confidence: conf,
        region: listRegion,
        scale: false,
      });
      const r = one.region;
      info(
        `windows.findTemplate conf=${conf} -> (${r.left - win.region.left},${r.top - win.region.top}) score=${one.score.toFixed(4)}`
      );
    } catch {
      info(`windows.findTemplate conf=${conf} -> no hit`);
    }
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("wechat-probe-match") ??
  false;
if (isDirect) {
  void runSmokeScript("wechat-probe-match", run);
}
