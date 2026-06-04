import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOnnxOcrEngine } from "./onnx";
import type { ResolvedOcrModels } from "./types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("onnxruntime-node", () => ({
  InferenceSession: { create: mocks.create },
  Tensor: class Tensor {
    constructor() {}
  },
}));

const tmpDirs: string[] = [];

beforeEach(() => {
  mocks.create.mockReset();
});

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("ONNX OCR output validation", () => {
  it("rejects sessions that return no tensor output", async () => {
    const detector = session({});
    const recognizer = session({});
    mocks.create.mockResolvedValueOnce(detector).mockResolvedValueOnce(recognizer);

    const engine = await createOnnxOcrEngine(models());

    await expect(engine.read(capture())).rejects.toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      context: { outputNames: [] },
      domain: "ocr",
    });
  });

  it("rejects non-Float32Array tensor data", async () => {
    const detector = session({ out: { data: [1], dims: [1] } });
    const recognizer = session({});
    mocks.create.mockResolvedValueOnce(detector).mockResolvedValueOnce(recognizer);

    const engine = await createOnnxOcrEngine(models());

    await expect(engine.read(capture())).rejects.toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      context: { label: "detection", dataType: "object" },
      domain: "ocr",
    });
  });

  it("rejects recognition tensors with invalid class dimensions", async () => {
    const detector = session({
      out: { data: new Float32Array([1, 1, 1, 1]), dims: [1, 1, 2, 2] },
    });
    const recognizer = session({
      out: { data: new Float32Array([0.1, 0.9, 0.2]), dims: [1, 2] },
    });
    mocks.create.mockResolvedValueOnce(detector).mockResolvedValueOnce(recognizer);

    const engine = await createOnnxOcrEngine(models());

    await expect(engine.read(capture())).rejects.toMatchObject({
      name: "SpotterError",
      code: "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      context: {
        label: "recognition",
        dims: [1, 2],
        dataLength: 3,
      },
      domain: "ocr",
    });
  });
});

function session(output: Record<string, unknown>) {
  return {
    inputNames: ["x"],
    run: vi.fn(async () => output),
  };
}

function models(): ResolvedOcrModels {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "spotter-onnx-test-"));
  tmpDirs.push(rootDir);
  fs.writeFileSync(path.join(rootDir, "dict.txt"), "a\nb\n");

  return {
    rootDir,
    files: {
      "det.onnx": path.join(rootDir, "det.onnx"),
      "rec.onnx": path.join(rootDir, "rec.onnx"),
      "dict.txt": path.join(rootDir, "dict.txt"),
    },
    profile: {
      name: "test",
      version: "test",
      files: [],
      detection: {
        modelFile: "det.onnx",
        inputWidth: 2,
        inputHeight: 2,
        mean: [0, 0, 0],
        std: [1, 1, 1],
        boxThreshold: 0.5,
      },
      recognition: {
        modelFile: "rec.onnx",
        dictionaryFile: "dict.txt",
        inputWidth: 2,
        inputHeight: 2,
        mean: [0, 0, 0],
        std: [1, 1, 1],
      },
    },
  };
}

function capture() {
  return {
    data: Buffer.alloc(2 * 2 * 4, 255),
    width: 2,
    height: 2,
  };
}
