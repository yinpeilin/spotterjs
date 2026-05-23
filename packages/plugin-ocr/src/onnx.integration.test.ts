import { describe, expect, it } from "vitest";
import { createOcr, resolveLocalOcrModels, type OcrBuiltInModelProfileName } from "./index";

const shouldRun = process.env.SPOTTERJS_OCR_INTEGRATION === "1";

describe.runIf(shouldRun)("real ONNX OCR integration", () => {
  it("recognizes text from a local image using downloaded or local ONNX models", async () => {
    const modelDir = process.env.SPOTTERJS_OCR_MODEL_DIR?.trim();
    const modelProfile = process.env.SPOTTERJS_OCR_MODEL_PROFILE?.trim() as
      | OcrBuiltInModelProfileName
      | undefined;
    const imagePath = requiredEnv("SPOTTERJS_OCR_TEST_IMAGE");
    const expectedText = process.env.SPOTTERJS_OCR_EXPECT_TEXT;

    const ocr = await createOcr(
      modelDir
        ? {
            models: resolveLocalOcrModels({
              modelDir,
              detInputWidth: Number(process.env.SPOTTERJS_OCR_DET_WIDTH || 960),
              detInputHeight: Number(process.env.SPOTTERJS_OCR_DET_HEIGHT || 960),
              recInputWidth: Number(process.env.SPOTTERJS_OCR_REC_WIDTH || 320),
              recInputHeight: Number(process.env.SPOTTERJS_OCR_REC_HEIGHT || 48),
            }),
          }
        : { modelProfile }
    );

    const lines = await ocr.read(imagePath);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.region.width).toBeGreaterThan(0);
      expect(line.region.height).toBeGreaterThan(0);
      expect(line.box).toHaveLength(4);
    }

    if (expectedText) {
      expect(lines.some((line) => line.text.includes(expectedText))).toBe(true);
    }

    console.log(JSON.stringify({ lines }, null, 2));
  });
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when SPOTTERJS_OCR_INTEGRATION=1`);
  }
  return value;
}
