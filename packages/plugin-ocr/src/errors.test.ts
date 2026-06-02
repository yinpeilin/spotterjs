import { describe, expect, it } from "vitest";
import { OcrError, isOcrError } from "./errors";

describe("OcrError", () => {
  it("keeps stable code, context, and cause", () => {
    const cause = new Error("download failed");
    const error = new OcrError("OCR_MODEL_DOWNLOAD_FAILED", "model download failed", {
      cause,
      context: { file: "det.onnx" },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("OcrError");
    expect(error.code).toBe("OCR_MODEL_DOWNLOAD_FAILED");
    expect(error.context).toEqual({ file: "det.onnx" });
    expect(error.cause).toBe(cause);
    expect(isOcrError(error)).toBe(true);
    expect(isOcrError(cause)).toBe(false);
  });
});
