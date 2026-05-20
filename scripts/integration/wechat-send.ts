/**
 * 微信发消息（模板匹配 + 键盘输入，不用 OCR / UIA）。
 *
 * 1. 准备联系人会话行 PNG → assets/wechat/templates/file-transfer-assistant.png
 * 2. npm run integration:wechat:send
 *
 * 环境变量：
 *   WECHAT_CONTACT_TEMPLATE  联系人行模板（默认见 assets/wechat/templates/）
 *   WECHAT_SEND_TEMPLATE   可选「发送」按钮模板；不设则 Enter 发送
 *   WECHAT_MESSAGE         消息正文
 *   WECHAT_MATCH_CONFIDENCE  默认 0.85
 *   WECHAT_CONTACT_ROW       候选序号（0=最上），多匹配时用
 *   WECHAT_CONTACT_Y         目标会话大致 Y（窗口内坐标），选最接近的候选
 *   WECHAT_DEBUG             1=保存匹配调试图到 test-output/
 *   WECHAT_EXE             微信路径
 */
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";
import type { MatchOptions, Point, Region } from "@spotter/base";
import { centerOf } from "@spotter/base";
import {
  clipboard,
  findAllInWindow,
  keyboard,
  loadNative,
  tapInWindow,
  windowApi,
} from "@spotter/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import { drawCrosshair, drawRectOutline, writeRgbaPng } from "../lib/png";

const REPO = path.resolve(__dirname, "../..");
const DEFAULT_TEMPLATE = path.join(
  REPO,
  "assets/wechat/templates/file-transfer-assistant.png"
);

const MESSAGE =
  process.env.WECHAT_MESSAGE?.trim() ||
  `Spotter 测试 ${new Date().toLocaleString()}`;

const WECHAT_PATHS = [
  process.env.WECHAT_EXE,
  "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
  "C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe",
].filter((p): p is string => !!p && p.length > 0);

type Win = {
  id: string;
  title: string;
  region: Region;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveTemplate(): string {
  const custom = process.env.WECHAT_CONTACT_TEMPLATE?.trim();
  if (custom && fs.existsSync(custom)) return path.resolve(custom);
  if (fs.existsSync(DEFAULT_TEMPLATE)) return DEFAULT_TEMPLATE;
  throw new Error(
    `缺少模板图。请从微信窗口截「文件传输助手」整行会话，保存为:\n  ${DEFAULT_TEMPLATE}\n说明: assets/wechat/templates/README.md`
  );
}

const MIN_MAIN_W = 400;
const MIN_MAIN_H = 300;

function syncWinRegion(win: Win): Win {
  const native = loadNative();
  const origin = native.getWindowClientOrigin(win.id);
  const cap = native.captureWindow(win.id);
  return {
    ...win,
    region: {
      left: origin.x,
      top: origin.y,
      width: cap.width,
      height: cap.height,
    },
  };
}

function assertMainWindow(win: Win): void {
  const { width, height } = win.region;
  if (width >= MIN_MAIN_W && height >= MIN_MAIN_H) return;
  throw new Error(
    `微信窗口过小 (${width}x${height})，请还原/最大化微信主窗口后再试`
  );
}

function contactListRegion(win: Win): Region {
  const { width: w, height: h } = win.region;
  return {
    left: 0,
    top: Math.floor(h * 0.08),
    width: Math.floor(w * 0.42),
    height: Math.floor(h * 0.82),
  };
}

function chatHeaderRegion(win: Win): Region {
  const { width: w, height: h } = win.region;
  return {
    left: Math.floor(w * 0.42),
    top: 0,
    width: Math.floor(w * 0.58),
    height: Math.floor(h * 0.1),
  };
}

function chatInputRegion(win: Win): Region {
  const { width: w, height: h } = win.region;
  return {
    left: Math.floor(w * 0.35),
    top: Math.floor(h * 0.72),
    width: Math.floor(w * 0.62),
    height: Math.floor(h * 0.26),
  };
}

function matchOpts(region: Region, confidence?: number): MatchOptions {
  const c = Number(process.env.WECHAT_MATCH_CONFIDENCE ?? "0.85");
  const conf = confidence ?? (Number.isFinite(c) ? c : 0.85);
  return {
    confidence: conf,
    searchRegion: region,
    multiScale: false,
  };
}

/** 识别框：screen/local 均为 left,top,width,height；center 为屏幕坐标点击点。 */
type MatchBox = {
  screen: Region;
  local: Region;
  center: Point;
};

function toMatchBox(win: Win, screen: Region): MatchBox {
  return {
    screen,
    local: {
      left: screen.left - win.region.left,
      top: screen.top - win.region.top,
      width: screen.width,
      height: screen.height,
    },
    center: centerOf(screen),
  };
}

function formatBox(label: string, r: Region): string {
  return `${label} left=${r.left} top=${r.top} width=${r.width} height=${r.height}`;
}

function readTemplateSize(templatePath: string): { width: number; height: number } {
  const png = PNG.sync.read(fs.readFileSync(templatePath));
  return { width: png.width, height: png.height };
}

function warnTemplateQuality(size: { width: number; height: number }): void {
  if (size.width < 180 || size.height < 40) {
    console.warn(
      `[WARN] 模板仅 ${size.width}x${size.height}px，易误匹配。` +
        `请重截整行会话（宽≥180、高≥48，含左侧头像），见 assets/wechat/templates/README.md`
    );
  }
}

type LocalMatch = MatchBox;

function findContactCandidates(
  win: Win,
  templatePath: string,
  listRegion: Region
): MatchBox[] {
  const regions = findAllInWindow(
    win.id,
    templatePath,
    matchOpts(listRegion)
  );
  return regions
    .map((region: Region) => toMatchBox(win, region))
    .filter(({ center }: MatchBox) =>
      pointInRegion(
        center.x - win.region.left,
        center.y - win.region.top,
        listRegion
      )
    )
    .sort((a: MatchBox, b: MatchBox) =>
      a.local.top - b.local.top || a.local.left - b.local.left
    );
}

function pickContactMatch(candidates: MatchBox[]): MatchBox {
  if (candidates.length === 0) {
    throw new Error(
      "会话列表内未找到模板。请重截整行会话图，或降低 WECHAT_MATCH_CONFIDENCE 后查看 test-output/wechat-contact-match.png"
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

function saveContactMatchDebug(
  win: Win,
  candidates: MatchBox[],
  picked: MatchBox,
  templateSize: { width: number; height: number }
): void {
  const smallTemplate =
    templateSize.width < 180 || templateSize.height < 40;
  if (
    process.env.WECHAT_DEBUG !== "1" &&
    candidates.length <= 1 &&
    !smallTemplate
  ) {
    return;
  }

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
    picked.center.x - win.region.left,
    picked.center.y - win.region.top
  );
  const out = path.join(ensureOutputDir(), "wechat-contact-match.png");
  writeRgbaPng(out, cap.width, cap.height, data);
  info(`调试图: ${out}（红=匹配框，绿十字=框中心点击点）`);
}

async function ensureWechatFocused(win: Win, step: string): Promise<void> {
  windowApi.focus(win.id);
  await sleep(450);
  const active = windowApi.getActive();
  if (!active?.title.includes("微信")) {
    throw new Error(
      `${step}: 微信未在前台（当前: "${active?.title ?? "无"}"）。` +
        `脚本运行期间请勿点终端；若仍失败可最小化终端后再试。`
    );
  }
}

function refreshWin(win: Win): Win {
  const latest = windowApi.list().find((w) => w.id === win.id);
  if (!latest) throw new Error("微信窗口已关闭");
  return syncWinRegion({
    id: latest.id,
    title: latest.title,
    region: latest.region,
  });
}

function pointInRegion(x: number, y: number, r: Region): boolean {
  return (
    x >= r.left &&
    x < r.left + r.width &&
    y >= r.top &&
    y < r.top + r.height
  );
}

function isTargetChatActive(win: Win, templatePath: string): boolean {
  const header = chatHeaderRegion(win);
  const hits = findAllInWindow(
    win.id,
    templatePath,
    matchOpts(header)
  );
  return hits.some((h) => {
    const cx = h.left - win.region.left + Math.floor(h.width / 2);
    return cx >= header.left && cx < header.left + header.width;
  });
}

async function waitForTargetChat(
  win: Win,
  templatePath: string,
  timeoutMs = 4000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    win = refreshWin(win);
    if (isTargetChatActive(win, templatePath)) return;
    await sleep(200);
  }
  throw new Error(
    "点击会话后右侧标题仍不是目标聊天。请重截模板或增大会话点击后等待时间。"
  );
}

async function tapContactSession(
  win: Win,
  templatePath: string,
  templateSize: { width: number; height: number }
): Promise<Region> {
  await ensureWechatFocused(win, "点击会话前");
  win = refreshWin(win);
  const listRegion = contactListRegion(win);
  const candidates = findContactCandidates(win, templatePath, listRegion);
  const box = pickContactMatch(candidates);
  saveContactMatchDebug(win, candidates, box, templateSize);

  info(formatBox("识别框(屏幕)", box.screen));
  info(formatBox("识别框(窗口内)", box.local));
  info(`点击中心 屏幕(${box.center.x},${box.center.y}) 窗口内(${box.center.x - win.region.left},${box.center.y - win.region.top})`);

  if (process.env.WECHAT_PROBE === "1") {
    info("WECHAT_PROBE=1，仅预览匹配，不点击");
    return box.screen;
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await ensureWechatFocused(win, `点击会话#${attempt}`);
    win = refreshWin(win);
    loadNative().tapAt(box.center.x, box.center.y);
    await sleep(200);
    loadNative().tapAt(box.center.x, box.center.y);
    await sleep(800);
    try {
      win = refreshWin(win);
      await waitForTargetChat(win, templatePath, 3000);
      info(`第 ${attempt} 次点击后会话已切换（右侧标题已匹配）`);
      return box.screen;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(
          "多次点击后会话仍未切换。左侧列表可见目标≠右侧已打开；请重截整行模板或设置 WECHAT_CONTACT_ROW"
        );
      }
      info(`第 ${attempt} 次点击未切换，重试…`);
    }
  }
  return box.screen;
}

async function typeIntoChat(win: Win, text: string): Promise<void> {
  win = refreshWin(win);
  await ensureWechatFocused(win, "输入前");

  const r = chatInputRegion(win);
  const tapX = win.region.left + r.left + Math.floor(r.width / 2);
  const tapY = win.region.top + r.top + Math.floor(r.height / 2);
  info(`点击输入框中心 屏幕(${tapX},${tapY}) 窗口内(${tapX - win.region.left},${tapY - win.region.top})`);

  loadNative().tapAt(tapX, tapY);
  await sleep(400);
  await ensureWechatFocused(win, "点击输入框后");

  clipboard.set(text);
  await sleep(150);
  keyboard.shortcut(["Ctrl", "V"]);
  await sleep(400);
}

export async function run(): Promise<void> {
  const templatePath = resolveTemplate();
  const templateSize = readTemplateSize(templatePath);
  warnTemplateQuality(templateSize);
  console.warn(`[WARN] 将发送消息: ${MESSAGE}`);
  info(`联系人模板: ${templatePath} (${templateSize.width}x${templateSize.height})`);

  let win = findWechat();
  if (!win) {
    info("启动微信 …");
    launchWechat();
    await sleep(4000);
    win = findWechat();
  }
  if (!win) throw new Error("请先登录微信");

  win = syncWinRegion(win);
  assertMainWindow(win);
  info(`窗口: "${win.title}" ${win.region.width}x${win.region.height}`);
  await ensureWechatFocused(win, "启动后");
  win = refreshWin(win);

  await tapContactSession(win, templatePath, templateSize);
  if (process.env.WECHAT_PROBE === "1") {
    info("探测完成（未发送消息）");
    return;
  }
  info("已点击左侧会话");

  await typeIntoChat(win, MESSAGE);

  win = refreshWin(win);
  await ensureWechatFocused(win, "发送前");
  const sendTpl = process.env.WECHAT_SEND_TEMPLATE?.trim();
  if (sendTpl && fs.existsSync(sendTpl)) {
    const { width: w, height: h } = win.region;
    const sendRegion: Region = {
      left: Math.floor(w * 0.72),
      top: Math.floor(h * 0.78),
      width: Math.floor(w * 0.26),
      height: Math.floor(h * 0.2),
    };
    tapInWindow(win.id, sendTpl, matchOpts(sendRegion));
    info("已点击发送按钮模板");
  } else {
    keyboard.press(["Enter"]);
    info("已按 Enter 发送");
  }

  info("完成，请目视确认聊天窗口");
}

function findWechat(): Win | null {
  const all = windowApi.list().filter((w) => w.title.includes("微信"));
  if (all.length === 0) return null;

  let candidates = all.filter(
    (w) => w.region.width >= MIN_MAIN_W && w.region.height >= MIN_MAIN_H
  );
  if (candidates.length === 0) {
    for (const w of all) {
      try {
        loadNative().restoreWindow(w.id);
      } catch {
        /* ignore */
      }
    }
    candidates = windowApi
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

function launchWechat(): void {
  for (const exe of WECHAT_PATHS) {
    if (!fs.existsSync(exe)) continue;
    execSync(`start "" "${exe}"`, { shell: "cmd.exe" });
    return;
  }
  throw new Error("找不到 WeChat.exe");
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("wechat-send") ?? false;

if (isDirect) {
  void runSmokeScript("wechat-send", run);
}
