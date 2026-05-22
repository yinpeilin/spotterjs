/**
 * 微信发消息（模板匹配 + 剪贴板输入）。
 *
 *   npm run integration:wechat:send
 *
 * 仅匹配、不发送：
 *   $env:WECHAT_PROBE="1"; npm run integration:wechat:send
 *
 * 环境变量见 assets/wechat/templates/README.md
 */
import { execSync } from "child_process";
import * as fs from "fs";
import type { Region } from "@spotterjs/base";
import {
  clipboard,
  keyboard,
  loadNative,
  tapInWindow,
  windowApi,
} from "@spotterjs/core";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import {
  assertMainWindow,
  findWechatWindow,
  readTemplateSize,
  resolveContactTemplate,
  sleep,
  syncWinRegion,
  tapAtScreen,
  tapContactInList,
  toScreen,
  warnTemplateQuality,
  type WechatWin,
} from "./lib/wechat-contact";

const MESSAGE =
  process.env.WECHAT_MESSAGE?.trim() ||
  `spotterjs 测试 ${new Date().toLocaleString()}`;

const WECHAT_PATHS = [
  process.env.WECHAT_EXE,
  "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe",
  "C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe",
].filter((p): p is string => !!p && p.length > 0);

function matchOpts(region: Region) {
  const c = Number(process.env.WECHAT_MATCH_CONFIDENCE ?? "0.72");
  return {
    confidence: Number.isFinite(c) ? c : 0.72,
    searchRegion: region,
    multiScale: false as const,
  };
}

function chatInputRegion(win: WechatWin): Region {
  const { width: w, height: h } = win.region;
  return {
    left: Math.floor(w * 0.35),
    top: Math.floor(h * 0.72),
    width: Math.floor(w * 0.62),
    height: Math.floor(h * 0.26),
  };
}

async function ensureWechatFocused(win: WechatWin, step: string): Promise<void> {
  windowApi.focus(win.id);
  await sleep(450);
  const active = windowApi.getActive();
  if (!active?.title.includes("微信")) {
    throw new Error(
      `${step}: 微信未在前台（当前: "${active?.title ?? "无"}"）。` +
        `脚本运行期间请勿点终端。`
    );
  }
}

function refreshWin(win: WechatWin): WechatWin {
  const latest = windowApi.list().find((w) => w.id === win.id);
  if (!latest) throw new Error("微信窗口已关闭");
  return syncWinRegion({
    id: latest.id,
    title: latest.title,
    region: latest.region,
  });
}

async function typeIntoChat(win: WechatWin, text: string): Promise<void> {
  let current = refreshWin(win);
  await ensureWechatFocused(current, "输入前");

  const r = chatInputRegion(current);
  const local = {
    x: r.left + Math.floor(r.width / 2),
    y: r.top + Math.floor(r.height / 2),
  };
  const tapScreen = toScreen(current.region, local);
  info(
    `点击输入框 窗口内(${local.x},${local.y}) 屏幕(${tapScreen.x},${tapScreen.y})`
  );

  tapAtScreen(tapScreen);
  await sleep(400);
  await ensureWechatFocused(current, "点击输入框后");

  clipboard.set(text);
  await sleep(150);
  keyboard.hotkey(["Ctrl", "V"]);
  await sleep(400);
}

function launchWechat(): void {
  for (const exe of WECHAT_PATHS) {
    if (!fs.existsSync(exe)) continue;
    execSync(`start "" "${exe}"`, { shell: "cmd.exe" });
    return;
  }
  throw new Error("找不到 WeChat.exe，可设置 WECHAT_EXE");
}

export async function run(): Promise<void> {
  const templatePath = resolveContactTemplate();
  const templateSize = readTemplateSize(templatePath);
  warnTemplateQuality(templateSize);

  if (process.env.WECHAT_PROBE !== "1") {
    console.warn(`[WARN] 将发送消息: ${MESSAGE}`);
  }
  info(`联系人模板: ${templatePath} (${templateSize.width}x${templateSize.height})`);

  let win = findWechatWindow();
  if (!win) {
    info("启动微信 …");
    launchWechat();
    await sleep(4000);
    win = findWechatWindow();
  }
  if (!win) throw new Error("请先登录微信");

  win = syncWinRegion(win);
  assertMainWindow(win);
  info(`窗口: "${win.title}" ${win.region.width}x${win.region.height}`);
  await ensureWechatFocused(win, "启动后");

  await tapContactInList(
    win,
    templatePath,
    templateSize,
    ensureOutputDir()
  );
  if (process.env.WECHAT_PROBE === "1") {
    info("WECHAT_PROBE=1，仅预览匹配，不发送");
    return;
  }

  await typeIntoChat(win, MESSAGE);

  const refreshed = refreshWin(win);
  await ensureWechatFocused(refreshed, "发送前");
  const sendTpl = process.env.WECHAT_SEND_TEMPLATE?.trim();
  if (sendTpl && fs.existsSync(sendTpl)) {
    const { width: w, height: h } = refreshed.region;
    tapInWindow(
      refreshed.id,
      sendTpl,
      matchOpts({
        left: Math.floor(w * 0.72),
        top: Math.floor(h * 0.78),
        width: Math.floor(w * 0.26),
        height: Math.floor(h * 0.2),
      })
    );
    info("已点击发送按钮模板");
  } else {
    keyboard.tap("Enter");
    info("已按 Enter 发送");
  }

  info("完成，请目视确认聊天窗口");
}

if (process.argv[1]?.replace(/\\/g, "/").includes("wechat-send")) {
  void runSmokeScript("wechat-send", run);
}
