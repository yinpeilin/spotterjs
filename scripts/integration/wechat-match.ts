/**
 * 微信：匹配左侧会话行并点击（不发送消息）。
 *
 *   npm run integration:wechat:match
 *
 * 仅预览匹配、不点击：
 *   $env:WECHAT_NO_TAP="1"; npm run integration:wechat:match
 *
 * 环境变量与 wechat-send 相同，见 assets/wechat/templates/README.md
 */
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";
import {
  assertMainWindow,
  findWechatWindow,
  readTemplateSize,
  resolveContactTemplate,
  tapContactInList,
  warnTemplateQuality,
} from "./lib/wechat-contact";

export async function run(): Promise<void> {
  const templatePath = resolveContactTemplate();
  const templateSize = readTemplateSize(templatePath);
  warnTemplateQuality(templateSize);
  info(`模板: ${templatePath} (${templateSize.width}x${templateSize.height})`);

  const win = findWechatWindow();
  if (!win) {
    throw new Error("未找到微信窗口，请先打开并登录微信");
  }
  assertMainWindow(win);
  info(`窗口: "${win.title}" ${win.region.width}x${win.region.height}`);

  await tapContactInList(
    win,
    templatePath,
    templateSize,
    ensureOutputDir()
  );

  if (process.env.WECHAT_NO_TAP === "1") {
    info("WECHAT_NO_TAP=1，未点击");
  } else if (process.env.WECHAT_PROBE === "1") {
    info("WECHAT_PROBE=1，未点击");
  } else {
    info("已点击，请目视确认右侧是否切到目标会话");
  }
}

if (process.argv[1]?.replace(/\\/g, "/").includes("wechat-match")) {
  void runSmokeScript("wechat-match", run);
}
