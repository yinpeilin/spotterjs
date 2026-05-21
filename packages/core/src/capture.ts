import type { CaptureImage } from "@spotter/base";
import { loadNative } from "./native";

/** Encode RGBA capture buffer as PNG bytes (Rust `image` crate). */
export function encodePng(capture: CaptureImage): Buffer {
  return loadNative().encodeCapturePng(capture);
}

/** Encode capture as base64 PNG string (for MCP / APIs). */
export function encodePngBase64(capture: CaptureImage): string {
  return loadNative().encodeCapturePngBase64(capture);
}
