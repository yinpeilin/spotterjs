import type { CaptureImage } from "@spotterjs/base";
import { loadNative } from "./native";
import { image } from "./image";

/**
 * Encode an RGBA {@link CaptureImage} as PNG bytes.
 *
 * Uses the Rust image pipeline. Suitable for saving to disk or uploading.
 */
export function encodePng(capture: CaptureImage): Buffer {
  return image.encode(capture);
}

/**
 * Encode an RGBA {@link CaptureImage} as a Base64 PNG string.
 *
 * Useful for JSON APIs and MCP payloads.
 */
export function encodePngBase64(capture: CaptureImage): string {
  return image.encodeBase64(capture);
}
