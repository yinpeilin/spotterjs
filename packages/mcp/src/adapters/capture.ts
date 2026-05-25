import { screen } from "@spotterjs/core";
import type { Region } from "@spotterjs/base";
import { writeCaptureArtifact } from "./artifacts.js";

export function captureScreenArtifact(region?: Region) {
  const img = screen.capture(region);
  return writeCaptureArtifact(img, { prefix: "desktop-screen" });
}

export function captureWindowArtifact(windowId: string) {
  const img = screen.captureWindow(windowId);
  return {
    ...writeCaptureArtifact(img, { prefix: "desktop-window" }),
    windowId,
  };
}

export function captureActiveArtifact() {
  const img = screen.captureActive();
  return writeCaptureArtifact(img, { prefix: "desktop-active" });
}
