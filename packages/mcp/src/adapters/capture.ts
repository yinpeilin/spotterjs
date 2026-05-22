import { captureToBase64, screen } from "@spotterjs/core";
import type { Region } from "@spotterjs/base";

export function captureScreenBase64(region?: Region) {
  const img = screen.capture(region);
  return {
    width: img.width,
    height: img.height,
    format: "png" as const,
    base64: captureToBase64(img),
  };
}

export function captureWindowBase64(windowId: string) {
  const img = screen.captureWindow(windowId);
  return {
    width: img.width,
    height: img.height,
    format: "png" as const,
    base64: captureToBase64(img),
    windowId,
  };
}

export function captureActiveBase64() {
  const img = screen.captureActive();
  return {
    width: img.width,
    height: img.height,
    format: "png" as const,
    base64: captureToBase64(img),
  };
}
