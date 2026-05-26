import { describe, expect, it, vi } from "vitest";
import { createOcr, resolveLocalOcrModels, type OcrBuiltInModelProfileName } from "./index";
import { createOnnxOcrEngine } from "./onnx";
import type { ResolvedOcrModels } from "./types";

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

describe("ONNX OCR engine options", () => {
  it("passes execution providers to detection and recognition sessions", async () => {
    const create = vi.fn(async () => ({
      inputNames: ["x"],
      run: vi.fn(),
    }));
    vi.doMock("onnxruntime-node", () => ({
      InferenceSession: { create },
      Tensor: class Tensor {
        constructor() {}
      },
    }));

    const dir = fsTmpDir();
    const dict = pathJoin(dir, "dict.txt");
    writeFile(dict, "a\n");
    const models: ResolvedOcrModels = {
      rootDir: dir,
      files: {
        "det.onnx": pathJoin(dir, "det.onnx"),
        "rec.onnx": pathJoin(dir, "rec.onnx"),
        "dict.txt": dict,
      },
      profile: {
        name: "test",
        version: "test",
        files: [],
        detection: {
          modelFile: "det.onnx",
          inputWidth: 8,
          inputHeight: 8,
          mean: [0, 0, 0],
          std: [1, 1, 1],
          boxThreshold: 0.3,
        },
        recognition: {
          modelFile: "rec.onnx",
          dictionaryFile: "dict.txt",
          inputWidth: 8,
          inputHeight: 8,
          mean: [0, 0, 0],
          std: [1, 1, 1],
        },
      },
    };

    await createOnnxOcrEngine(models, {
      executionProviders: ["dml", "cpu"],
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toEqual({
      executionProviders: ["dml", "cpu"],
    });
    expect(create.mock.calls[1][1]).toEqual({
      executionProviders: ["dml", "cpu"],
    });

    vi.doUnmock("onnxruntime-node");
  });
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when SPOTTERJS_OCR_INTEGRATION=1`);
  }
  return value;
}

function fsTmpDir(): string {
  const fs = require("fs") as typeof import("fs");
  const os = require("os") as typeof import("os");
  const path = require("path") as typeof import("path");
  return fs.mkdtempSync(path.join(os.tmpdir(), "spotter-ocr-onnx-test-"));
}

function pathJoin(...parts: string[]): string {
  const path = require("path") as typeof import("path");
  return path.join(...parts);
}

function writeFile(file: string, content: string): void {
  const fs = require("fs") as typeof import("fs");
  fs.writeFileSync(file, content);
}
