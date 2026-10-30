import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  captureWindow: vi.fn(),
  captureActive: vi.fn(),
  encode: vi.fn(() => Buffer.from("png")),
}));

vi.mock("@spotterjs/core", () => ({
  screen: {
    capture: mocks.capture,
    captureWindow: mocks.captureWindow,
    captureActive: mocks.captureActive,
  },
  image: {
    encode: mocks.encode,
  },
}));

import { workspaceImageStore } from "./artifacts";
import {
  captureActiveArtifact,
  captureScreenArtifact,
  captureWindowArtifact,
} from "./capture";

const image = { data: Buffer.alloc(4), width: 1, height: 1 };

beforeEach(() => {
  mocks.capture.mockReset();
  mocks.captureWindow.mockReset();
  mocks.captureActive.mockReset();
  vi.restoreAllMocks();
});

describe("capture artifact adapters", () => {
  it("captures the screen with region and writes a desktop-screen artifact", () => {
    mocks.capture.mockReturnValue(image);
    const writeCapture = vi
      .spyOn(workspaceImageStore, "writeCapture")
      .mockReturnValue({ imagePath: ".spotter/artifacts/screen.png" } as never);
    const region = { left: 1, top: 2, width: 3, height: 4 };

    expect(captureScreenArtifact(region, { detail: "original" })).toEqual({
      imagePath: ".spotter/artifacts/screen.png",
      origin: { x: 1, y: 2 },
      coordinateSpace: "screen",
    });
    expect(mocks.capture).toHaveBeenCalledWith(region);
    expect(writeCapture).toHaveBeenCalledWith(image, {
      prefix: "desktop-screen",
      detail: "original",
    });
  });

  it("keeps screen origin separate from resized preview dimensions", () => {
    mocks.capture.mockReturnValue(image);
    vi.spyOn(workspaceImageStore, "writeCapture").mockReturnValue({
      imagePath: ".spotter/artifacts/preview.png",
      width: 1600, height: 800, originalWidth: 3200, originalHeight: 1600,
      isDownscaled: true,
    } as never);
    expect(captureScreenArtifact({ left: -3200, top: 80, width: 3200, height: 1600 }))
      .toMatchObject({ origin: { x: -3200, y: 80 }, coordinateSpace: "screen", width: 1600, originalWidth: 3200 });
    expect(captureScreenArtifact()).toMatchObject({ origin: { x: 0, y: 0 } });
  });

  it("captures a window and includes the source window id", () => {
    mocks.captureWindow.mockReturnValue(image);
    const writeCapture = vi
      .spyOn(workspaceImageStore, "writeCapture")
      .mockReturnValue({ imagePath: ".spotter/artifacts/window.png" } as never);

    expect(captureWindowArtifact("0x2")).toEqual({
      imagePath: ".spotter/artifacts/window.png",
      windowId: "0x2",
    });
    expect(mocks.captureWindow).toHaveBeenCalledWith("0x2");
    expect(writeCapture).toHaveBeenCalledWith(image, {
      prefix: "desktop-window",
      detail: undefined,
    });
  });

  it("captures the active window with the desktop-active prefix", () => {
    mocks.captureActive.mockReturnValue(image);
    const writeCapture = vi
      .spyOn(workspaceImageStore, "writeCapture")
      .mockReturnValue({ imagePath: ".spotter/artifacts/active.png" } as never);

    expect(captureActiveArtifact({ detail: "high" })).toEqual({
      imagePath: ".spotter/artifacts/active.png",
    });
    expect(mocks.captureActive).toHaveBeenCalled();
    expect(writeCapture).toHaveBeenCalledWith(image, {
      prefix: "desktop-active",
      detail: "high",
    });
  });
});
