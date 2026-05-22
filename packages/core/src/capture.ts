import type { CaptureImage } from "@spotterjs/base";
import { loadNative } from "./native";

/**
 * 将 RGBA {@link CaptureImage} 编码为 PNG 字节。
 *
 * 使用 Rust `image` crate，适合落盘或 HTTP 上传。
 */
export function encodePng(capture: CaptureImage): Buffer {
  return loadNative().encodeCapturePng(capture);
}

/**
 * 将截图编码为 Base64 PNG 字符串。
 *
 * 常用于 MCP 工具返回或 JSON API。
 */
export function encodePngBase64(capture: CaptureImage): string {
  return loadNative().encodeCapturePngBase64(capture);
}
