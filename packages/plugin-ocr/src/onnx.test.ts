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
    constructor(
      readonly type: string,
      readonly data: Float32Array,
      readonly dims: number[]
    ) {}
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

  it.each([
    { dims: [1, 1, 2, 2], data: new Float32Array(3) },
    { dims: [1, 2, 2, 2], data: new Float32Array(8) },
  ])("rejects malformed or multichannel detector maps ($dims)", async ({ dims, data }) => {
    mocks.create.mockResolvedValueOnce(session({ out: { data, dims } }))
      .mockResolvedValueOnce(session({}));
    const engine = await createOnnxOcrEngine(models());
    await expect(engine.read(capture())).rejects.toMatchObject({
      code: "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      context: { label: "detection", dims, dataLength: data.length },
    });
  });
});

describe("ONNX OCR image geometry", () => {
  it.each([[12, 4], [4, 12]])("preserves %ix%i image aspect in a fixed detector tensor", async (width, height) => {
    const config = models();
    config.profile.detection.inputWidth = 12;
    config.profile.detection.inputHeight = 12;
    const detector = session({ out: { data: new Float32Array(144), dims: [1, 1, 12, 12] } });
    mocks.create.mockResolvedValueOnce(detector).mockResolvedValueOnce(session({}));
    const engine = await createOnnxOcrEngine(config);

    await expect(engine.read(redImage(width, height))).resolves.toEqual([]);

    const tensor = detector.run.mock.calls[0][0].x as { data: Float32Array; dims: number[] };
    expect(tensor.dims).toEqual([1, 3, 12, 12]);
    // The source is red, while unused canvas pixels stay white rather than stretching text.
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      expect(tensor.data[144 + y * 12 + x]).toBe(x < width && y < height ? 0 : 1);
    }
  });

  it("preserves crop aspect and pads recognition columns after normalization", async () => {
    const config = models();
    config.profile.detection.inputWidth = 16;
    config.profile.detection.inputHeight = 16;
    config.profile.recognition.inputWidth = 32;
    config.profile.recognition.inputHeight = 4;
    config.profile.recognition.mean = [0.5, 0.5, 0.5];
    config.profile.recognition.std = [0.5, 0.5, 0.5];
    const detector = detectionSession(16, 16, [{ left: 0, top: 0, width: 16, height: 4 }]);
    const recognizer = recognitionSession();
    mocks.create.mockResolvedValueOnce(detector).mockResolvedValueOnce(recognizer);
    const engine = await createOnnxOcrEngine(config);

    const [line] = await engine.read(redImage(16, 4));

    expect(line.text).toBe("a");
    expect(line.region).toEqual({ left: 0, top: 0, width: 16, height: 4 });
    const tensor = recognizer.run.mock.calls[0][0].x as { data: Float32Array; dims: number[] };
    expect(tensor.dims).toEqual([1, 3, 4, 32]);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 32; x++) {
      expect(tensor.data[y * 32 + x]).toBe(x < 16 ? 1 : 0);
      expect(tensor.data[128 + y * 32 + x]).toBe(x < 16 ? -1 : 0);
    }
  });

  it("expands a shrunken text kernel before cropping complete glyphs", async () => {
    const config = models();
    config.profile.detection.inputWidth = 32;
    config.profile.detection.inputHeight = 32;
    mocks.create.mockResolvedValueOnce(detectionSession(32, 32, [
      { left: 8, top: 12, width: 16, height: 8 },
    ])).mockResolvedValueOnce(recognitionSession());
    const engine = await createOnnxOcrEngine(config);

    const [line] = await engine.read(redImage(32, 32));

    // The glyph envelope extends beyond the DB probability kernel on every side.
    expect(line.region.left).toBeLessThanOrEqual(4);
    expect(line.region.top).toBeLessThanOrEqual(8);
    expect(line.region.left + line.region.width).toBeGreaterThanOrEqual(28);
    expect(line.region.top + line.region.height).toBeGreaterThanOrEqual(24);
  });

  it("maps a downsampled detector output and ignores boxes entirely in padding", async () => {
    const config = models();
    config.profile.detection.inputWidth = 16;
    config.profile.detection.inputHeight = 16;
    const recognizer = recognitionSession();
    mocks.create.mockResolvedValueOnce(detectionSession(8, 8, [
      { left: 1, top: 1, width: 4, height: 2 },
      { left: 1, top: 6, width: 3, height: 2 },
    ])).mockResolvedValueOnce(recognizer);
    const engine = await createOnnxOcrEngine(config);

    const lines = await engine.read(redImage(16, 8));

    expect(lines).toHaveLength(1);
    expect(recognizer.run).toHaveBeenCalledTimes(1);
    expect(lines[0].region.width).toBeGreaterThan(8);
    expect(lines[0].region.left + lines[0].region.width).toBeLessThanOrEqual(16);
    expect(lines[0].region.top + lines[0].region.height).toBeLessThanOrEqual(8);
    for (const point of lines[0].box) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(16);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(8);
    }
  });
});

function session(output: Record<string, unknown>) {
  return {
    inputNames: ["x"],
    run: vi.fn(async (_feeds: Record<string, unknown>) => output),
  };
}

function recognitionSession() {
  return session({ out: { data: new Float32Array([0.1, 0.9]), dims: [1, 1, 2] } });
}

function detectionSession(width: number, height: number, regions: Array<{
  left: number; top: number; width: number; height: number;
}>) {
  const data = new Float32Array(width * height);
  for (const region of regions) {
    for (let y = region.top; y < region.top + region.height; y++) {
      for (let x = region.left; x < region.left + region.width; x++) data[y * width + x] = 1;
    }
  }
  return session({ out: { data, dims: [1, 1, height, width] } });
}

function redImage(width: number, height: number) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
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
