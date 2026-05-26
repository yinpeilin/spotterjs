import type { CaptureImage } from "@spotterjs/base";
import { loadNative } from "./native";

/**
 * Encode an RGBA {@link CaptureImage} as PNG bytes.
 *
 * Uses the Rust image pipeline. Suitable for saving to disk or uploading.
 */
export function encodePng(capture: CaptureImage): Buffer {
  return loadNative().encodeCapturePng(capture);
}

/**
 * Encode an RGBA {@link CaptureImage} as a Base64 PNG string.
 *
 * Useful for JSON APIs and MCP payloads.
 */
export function encodePngBase64(capture: CaptureImage): string {
  return loadNative().encodeCapturePngBase64(capture);
}
