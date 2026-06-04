import { describe, expect, it } from "vitest";
import { isSpotterError, SpotterError } from "./errors";

describe("SpotterError for OCR", () => {
  it("keeps stable code, context, and cause", () => {
    const cause = new Error("download failed");
    const error = new SpotterError(
      "SPOTTER_OCR_MODEL_DOWNLOAD_FAILED",
      "model download failed",
      {
        cause,
        context: { file: "det.onnx" },
        domain: "ocr",
      }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SpotterError");
    expect(error.code).toBe("SPOTTER_OCR_MODEL_DOWNLOAD_FAILED");
    expect(error.domain).toBe("ocr");
    expect(error.context).toEqual({ file: "det.onnx" });
    expect(error.cause).toBe(cause);
    expect(isSpotterError(error)).toBe(true);
    expect(isSpotterError(cause)).toBe(false);
  });
});
