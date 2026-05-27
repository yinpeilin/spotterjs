import { screen } from "@spotterjs/core";
import type { Region } from "@spotterjs/base";
import {
  type CaptureArtifactDetail,
  workspaceImageStore,
} from "./artifacts.js";

type CaptureOptions = {
  detail?: CaptureArtifactDetail;
};

/** Capture the full screen or a region and write a workspace PNG artifact. */
export function captureScreenArtifact(region?: Region, options: CaptureOptions = {}) {
  const img = screen.capture(region);
  return workspaceImageStore.writeCapture(img, {
    prefix: "desktop-screen",
    detail: options.detail,
  });
}

/** Capture a desktop window and write a workspace PNG artifact. */
export function captureWindowArtifact(windowId: string, options: CaptureOptions = {}) {
  const img = screen.captureWindow(windowId);
  return {
    ...workspaceImageStore.writeCapture(img, {
      prefix: "desktop-window",
      detail: options.detail,
    }),
    windowId,
  };
}

/** Capture the active desktop window and write a workspace PNG artifact. */
export function captureActiveArtifact(options: CaptureOptions = {}) {
  const img = screen.captureActive();
  return workspaceImageStore.writeCapture(img, {
    prefix: "desktop-active",
    detail: options.detail,
  });
}
