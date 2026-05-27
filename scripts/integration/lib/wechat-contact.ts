/**

 * 微信窗口 + 左侧会话列表模板匹配（NCC）。

 * 供 wechat-match.ts / wechat-send.ts 共用。

 */

import * as fs from "fs";

import * as path from "path";

import type { MatchOptions, Point, Region } from "@spotterjs/base";
import { loadNative } from "@spotterjs/core/unstable-native";

import {
  matchTapScreen,

  toLocal,

  toMatchBox,

  toScreen,

  windows,

  type MatchBox,
  image,

} from "@spotterjs/core";

import { info } from "../../lib/log";

import { drawCrosshair, drawRectOutline, writeRgbaPng } from "../../lib/png";



export type { MatchBox } from "@spotterjs/core";

export { matchTapScreen, toLocal, toScreen };



export const REPO = path.resolve(__dirname, "../../..");

export const DEFAULT_CONTACT_TEMPLATE = path.join(

  REPO,

  "assets/wechat/templates/file-transfer-assistant.png"

);



export const MIN_MAIN_W = 400;

export const MIN_MAIN_H = 300;



export type WechatWin = {

  id: string;

  title: string;

  region: Region;

};



export function tapLocal(win: WechatWin, local: Point): void {

  const p = toScreen(win.region, local);

  loadNative().tapAt(p.x, p.y);

}



export function tapAtScreen(point: Point): void {
  loadNative().tapAt(point.x, point.y);
}



export function tapMatchBox(_win: WechatWin, box: MatchBox): void {

  tapAtScreen(matchTapScreen(box));

}



/** 左侧会话行选中时行背景变亮（在匹配框中心采样，排除左侧纯绿图标） */
export function isContactRowSelected(win: WechatWin, box: MatchBox): boolean {
  const cap = loadNative().captureWindow(win.id);
  const data = cap.data;
  const x = Math.min(cap.width - 1, Math.max(0, box.localCenter.x));
  const y = Math.min(cap.height - 1, Math.max(0, box.localCenter.y));
  const idx = (y * cap.width + x) * 4;
  const r = data[idx]!;
  const g = data[idx + 1]!;
  const b = data[idx + 2]!;
  const lum = r + g + b;
  const isIconGreen = g > 140 && r < 90 && b < 90;
  if (isIconGreen) return false;
  return lum > 195 && g >= r - 15 && g >= b - 15;
}



const MAX_CONTACT_NAME_X = 400;



export function sleep(ms: number): Promise<void> {

  return new Promise((r) => setTimeout(r, ms));

}



export function resolveContactTemplate(): string {

  const custom = process.env.WECHAT_CONTACT_TEMPLATE?.trim();

  if (custom && fs.existsSync(custom)) return path.resolve(custom);

  if (fs.existsSync(DEFAULT_CONTACT_TEMPLATE)) return DEFAULT_CONTACT_TEMPLATE;

  throw new Error(

    `缺少模板图。请从微信窗口截「文件传输助手」会话行，保存为:\n  ${DEFAULT_CONTACT_TEMPLATE}\n说明: assets/wechat/templates/README.md`

  );

}



export function readTemplateSize(templatePath: string): {

  width: number;

  height: number;

} {

  return image.size(templatePath);

}



export function warnTemplateQuality(size: {

  width: number;

  height: number;

}): void {

  if (size.width < 120 || size.height < 20) {

    console.warn(

      `[WARN] 模板过小 ${size.width}x${size.height}px，易误匹配。` +

        `建议截整行（含左侧图标，宽≥180、高≥48），见 assets/wechat/templates/README.md`

    );

  }

}



export function syncWinRegion(win: WechatWin): WechatWin {

  const native = loadNative();

  const frame = native.getWindowRegion(win.id);

  const cap = native.captureWindow(win.id);

  return {

    ...win,

    region: {

      left: frame.left,

      top: frame.top,

      width: cap.width,

      height: cap.height,

    },

  };

}



export function assertMainWindow(win: WechatWin): void {

  const { width, height } = win.region;

  if (width >= MIN_MAIN_W && height >= MIN_MAIN_H) return;

  throw new Error(

    `微信窗口过小 (${width}x${height})，请还原/最大化微信主窗口后再试`

  );

}



export function findWechatWindow(): WechatWin | null {

  const all = windows.list().filter((w) => w.title.includes("微信"));

  if (all.length === 0) return null;



  let candidates = all.filter(

    (w) => w.region.width >= MIN_MAIN_W && w.region.height >= MIN_MAIN_H

  );

  if (candidates.length === 0) {

    for (const w of all) {

      try {

        windows.restore(w.id);

      } catch {

        /* ignore */

      }

    }

    candidates = windows

      .list()

      .filter((w) => w.title.includes("微信"))

      .filter(

        (w) => w.region.width >= MIN_MAIN_W && w.region.height >= MIN_MAIN_H

      );

  }

  if (candidates.length === 0) return null;



  const w = candidates.sort(

    (a, b) =>

      b.region.width * b.region.height - a.region.width * a.region.height

  )[0];

  return syncWinRegion({ id: w.id, title: w.title, region: w.region });

}



export function contactListRegion(win: WechatWin): Region {

  const { width: w, height: h } = win.region;

  return {

    left: 0,

    top: Math.floor(h * 0.08),

    width: Math.floor(w * 0.42),

    height: Math.floor(h * 0.82),

  };

}



function contactSearchRegions(w: number, h: number): Region[] {

  const top = Math.floor(h * 0.08);

  const left = 88;

  const width = Math.min(320, Math.floor(w * 0.22));

  return [

    { left, top, width, height: Math.min(360, Math.floor(h * 0.42)) },

    { left, top, width, height: Math.floor(h * 0.82) },

  ];

}



function matchOpts(region: Region, confidence?: number): MatchOptions {

  const c = Number(process.env.WECHAT_MATCH_CONFIDENCE ?? "0.72");

  const conf = confidence ?? (Number.isFinite(c) ? c : 0.72);

  return {

    confidence: conf,

    region,

    scale: false,

  };

}



function formatBox(label: string, r: Region): string {

  return `${label} left=${r.left} top=${r.top} width=${r.width} height=${r.height}`;

}



function pointInRegion(x: number, y: number, r: Region): boolean {

  return (

    x >= r.left &&

    x < r.left + r.width &&

    y >= r.top &&

    y < r.top + r.height

  );

}



export function findContactCandidates(

  win: WechatWin,

  templatePath: string,

  listRegion: Region

): MatchBox[] {

  const { width: w, height: h } = win.region;

  const searchRegions = contactSearchRegions(w, h);

  const base = Number(process.env.WECHAT_MATCH_CONFIDENCE ?? "0.72");

  const confidences = (

    Number.isFinite(base) ? [base, base - 0.08, base - 0.16] : [0.72, 0.64, 0.56]

  ).filter((c) => c >= 0.52);



  const seen = new Set<string>();

  const boxes: MatchBox[] = [];



  for (const conf of confidences) {

    for (const searchRegion of searchRegions) {

      const opts = matchOpts(searchRegion, conf);

      let matches = windows.findAllTemplates(win.id, templatePath, opts);

      if (matches.length === 0) {

        try {

          matches = [windows.findTemplate(win.id, templatePath, opts)];

        } catch {

          /* 本区未命中 */

        }

      }

      for (const match of matches) {

        const region = match.region;

        const box = toMatchBox(win.region, region);

        const { x: cx, y: cy } = box.localCenter;

        if (!pointInRegion(cx, cy, listRegion)) continue;

        if (box.local.left > MAX_CONTACT_NAME_X) continue;

        const key = `${box.local.left},${box.local.top}`;

        if (seen.has(key)) continue;

        seen.add(key);

        boxes.push(box);

      }

    }

    if (boxes.length > 0) break;

  }



  return boxes.sort(

    (a, b) => a.local.top - b.local.top || a.local.left - b.local.left

  );

}



export function pickContactMatch(candidates: MatchBox[]): MatchBox {

  if (candidates.length === 0) {

    throw new Error(

      "会话列表内未找到模板。请重截会话行图，或降低 WECHAT_MATCH_CONFIDENCE 后查看 test-output/wechat-contact-match.png"

    );

  }



  for (const [i, c] of candidates.entries()) {

    info(`  候选[${i}] ${formatBox("窗口内", c.local)}`);

  }



  const rowHint = process.env.WECHAT_CONTACT_ROW?.trim();

  if (rowHint !== undefined && rowHint.length > 0) {

    const idx = Number(rowHint);

    if (!Number.isFinite(idx) || idx < 0 || idx >= candidates.length) {

      throw new Error(

        `WECHAT_CONTACT_ROW=${rowHint} 越界，共 ${candidates.length} 个候选（0=最上）`

      );

    }

    return candidates[idx];

  }



  const yHint = process.env.WECHAT_CONTACT_Y?.trim();

  if (yHint !== undefined && yHint.length > 0) {

    const targetY = Number(yHint);

    if (!Number.isFinite(targetY)) {

      throw new Error("WECHAT_CONTACT_Y 须为数字（窗口内 Y 坐标）");

    }

    return candidates.reduce((best, cur) =>

      Math.abs(cur.local.top - targetY) < Math.abs(best.local.top - targetY)

        ? cur

        : best

    );

  }



  if (candidates.length > 1) {

    console.warn(

      `[WARN] 找到 ${candidates.length} 处相似匹配，默认选最上行 [0]。` +

        `若不对，设置 WECHAT_CONTACT_ROW 或 WECHAT_CONTACT_Y。`

    );

  }

  return candidates[0];

}



export function saveContactMatchDebug(

  win: WechatWin,

  candidates: MatchBox[],

  picked: MatchBox,

  outDir: string

): void {

  const cap = loadNative().captureWindow(win.id);

  const data = Buffer.from(cap.data);

  for (const c of candidates) {

    const color =

      c === picked ? ([255, 0, 0] as const) : ([255, 200, 0] as const);

    drawRectOutline(data, cap.width, cap.height, c.local, color);

  }

  drawCrosshair(

    data,

    cap.width,

    cap.height,

    picked.localCenter.x,

    picked.localCenter.y

  );

  const out = path.join(outDir, "wechat-contact-match.png");

  writeRgbaPng(out, cap.width, cap.height, data);

  info(`调试图: ${out}（红=选中，黄=其他候选，绿十字=点击点）`);

}



export async function matchContactInList(

  win: WechatWin,

  templatePath: string,

  templateSize: { width: number; height: number },

  outDir: string

): Promise<MatchBox> {

  windows.focus(win.id);

  await sleep(450);

  const current = syncWinRegion(win);



  const listRegion = contactListRegion(current);

  const candidates = findContactCandidates(current, templatePath, listRegion);

  const picked = pickContactMatch(candidates);



  if (

    process.env.WECHAT_DEBUG === "1" ||

    candidates.length > 1 ||

    templateSize.width < 180

  ) {

    saveContactMatchDebug(current, candidates, picked, outDir);

  }



  const tapScreen = matchTapScreen(picked);

  info(formatBox("识别框(屏幕)", picked.screen));

  info(formatBox("识别框(窗口内)", picked.local));

  info(

    `点击中心 窗口内(${picked.localCenter.x},${picked.localCenter.y}) 屏幕(${tapScreen.x},${tapScreen.y})`

  );



  return picked;

}



export async function tapContactInList(
  win: WechatWin,
  templatePath: string,
  templateSize: { width: number; height: number },
  outDir: string,
  opts?: { verify?: boolean }
): Promise<MatchBox> {
  const picked = await matchContactInList(
    win,
    templatePath,
    templateSize,
    outDir
  );

  if (process.env.WECHAT_NO_TAP === "1" || process.env.WECHAT_PROBE === "1") {
    return picked;
  }

  windows.focus(win.id);
  await sleep(450);
  tapMatchBox(syncWinRegion(win), picked);

  const tap = matchTapScreen(picked);
  info(`点击 屏幕(${tap.x},${tap.y})`);

  if (opts?.verify === false) {
    return picked;
  }

  if (!isContactRowSelected(syncWinRegion(win), picked)) {
    throw new Error(
      "点击后会话未切换。请重截模板或设置 WECHAT_CONTACT_ROW / WECHAT_CONTACT_Y"
    );
  }

  info("会话已切换");
  return picked;
}



function chatHeaderRegion(win: WechatWin): Region {

  const { width: w, height: h } = win.region;

  return {

    left: Math.floor(w * 0.42),

    top: 0,

    width: Math.floor(w * 0.58),

    height: Math.floor(h * 0.1),

  };

}



export function isTargetChatActive(

  win: WechatWin,

  templatePath: string

): boolean {

  const header = chatHeaderRegion(win);

  const hits = windows.findAllTemplates(win.id, templatePath, matchOpts(header));

  return hits.some((h) => {

    const r = h.region;

    const local = toLocal(win.region, {

      x: r.left + Math.floor(r.width / 2),

      y: r.top + Math.floor(r.height / 2),

    });

    return local.x >= header.left && local.x < header.left + header.width;

  });

}


