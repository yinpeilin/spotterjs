/**
 * OCR 插件（预留）。
 *
 * Tesseract.js 已验证不适合微信等 UI 的「按文字点击」（词块坐标不可靠）。
 * 后续优先考虑 PaddleOCR（中文 + 检测框）接入本包。
 *
 * 微信发消息请用模板匹配: npm run integration:wechat:send
 */

export type { Region } from "@spotterjs/base";

export function useOcrPlugin(): never {
  throw new Error(
    "@spotterjs/plugin-ocr: Tesseract 已停用。微信请用模板匹配 (integration:wechat:send)。后续 OCR 计划: PaddleOCR。"
  );
}
