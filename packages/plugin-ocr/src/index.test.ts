import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOcr,
  defaultModelDir,
  ensureOcrModels,
  ocrModelBaseUrl,
  ocrModelMirrorBaseUrl,
  PPOCRV5_MOBILE_PROFILE,
  PPOCRV4_SERVER_PROFILE,
  PPOCRV5_SERVER_PROFILE,
  resolveLocalOcrModels,
  resolveOcrModelProfile,
  OcrError,
  isOcrError,
  scoreOcrText,
  type OcrEngine,
  type OcrModelProfile,
  type OcrSession,
  type OcrTextLine,
} from "./index";
import { cropImage, loadImage, resizeRgba, validateRegion } from "./image";

const tmpDirs: string[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spotter-ocr-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SPOTTERJS_OCR_MODEL_DIR;
  delete process.env.SPOTTERJS_OCR_MODEL_BASE_URL;
  delete process.env.SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL;
  delete process.env.SPOTTERJS_OCR_MODEL_SOURCE;
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function testProfile(files: Record<string, string>): OcrModelProfile {
  return {
    name: "ppocrv5-mobile-test",
    version: "test",
    files: Object.entries(files).map(([name, sha256]) => ({
      name,
      url: `https://example.test/${name}`,
      sha256,
    })),
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
      inputWidth: 4,
      inputHeight: 2,
      mean: [0, 0, 0],
      std: [1, 1, 1],
    },
  };
}

describe("model cache", () => {
  it("defaults to the server model profile", async () => {
    const modelDir = tmpDir();
    const fetchFile = vi.fn(async () => Buffer.from("model-bytes"));

    const resolved = await ensureOcrModels({
      modelDir,
      fetchFile,
      modelSource: "mirror",
    });

    expect(resolved.profile.name).toBe("ppocrv5-server");
    expect(resolved.rootDir).toContain(path.join("ppocrv5-server", PPOCRV5_SERVER_PROFILE.version));
  });

  it("allows selecting built-in server and mobile profiles by name", () => {
    expect(resolveOcrModelProfile("server")).toBe(PPOCRV5_SERVER_PROFILE);
    expect(resolveOcrModelProfile("ppocrv5-server")).toBe(PPOCRV5_SERVER_PROFILE);
    expect(resolveOcrModelProfile("large")).toBe(PPOCRV4_SERVER_PROFILE);
    expect(resolveOcrModelProfile("ppocrv4-server")).toBe(PPOCRV4_SERVER_PROFILE);
    expect(resolveOcrModelProfile("mobile")).toBe(PPOCRV5_MOBILE_PROFILE);
    expect(resolveOcrModelProfile("ppocrv5-mobile")).toBe(PPOCRV5_MOBILE_PROFILE);
    expect(() =>
      resolveOcrModelProfile("unknown" as Parameters<typeof resolveOcrModelProfile>[0])
    ).toThrow(OcrError);
    try {
      resolveOcrModelProfile("unknown" as Parameters<typeof resolveOcrModelProfile>[0]);
    } catch (error) {
      expect(isOcrError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "OCR_MODEL_PROFILE_UNKNOWN",
        context: { profile: "unknown" },
      });
    }
  });

  it("downloads the selected built-in mobile profile", async () => {
    const modelDir = tmpDir();
    const fetchFile = vi.fn(async (_url: string) => Buffer.from("model-bytes"));

    const resolved = await ensureOcrModels({
      modelDir,
      modelProfile: "mobile",
      fetchFile,
      modelSource: "mirror",
    });

    expect(resolved.profile.name).toBe("ppocrv5-mobile");
    expect(fetchFile.mock.calls.map(([url]) => url)).toEqual(
      PPOCRV5_MOBILE_PROFILE.files.map((file) =>
        expect.stringContaining(file.mirrorUrl ?? file.url)
      )
    );
  });

  it("uses a downloadable default model base url and allows env override", () => {
    expect(ocrModelBaseUrl()).toContain("huggingface.co");

    process.env.SPOTTERJS_OCR_MODEL_BASE_URL = "https://example.test/ocr";
    expect(ocrModelBaseUrl()).toBe("https://example.test/ocr");
  });

  it("has a configurable mirror base url", () => {
    expect(ocrModelMirrorBaseUrl()).toContain("hf-mirror.com");

    process.env.SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL = "https://mirror.test/ocr";
    expect(ocrModelMirrorBaseUrl()).toBe("https://mirror.test/ocr");
  });

  it("uses platform default path and allows env override", () => {
    const expectedSuffix = path.join("spotterjs", "ocr");
    expect(defaultModelDir().endsWith(expectedSuffix)).toBe(true);

    process.env.SPOTTERJS_OCR_MODEL_DIR = path.join(tmpDir(), "models");
    expect(defaultModelDir()).toBe(process.env.SPOTTERJS_OCR_MODEL_DIR);
  });

  it("downloads missing files, verifies sha256, and skips existing files", async () => {
    const modelDir = tmpDir();
    const bytes = Buffer.from("model-bytes");
    const hash = "357e5d6fafa34d27360fec24b4326d3534905e33c6acdee60198fb078b7b79e5";
    const profile = testProfile({ "det.onnx": hash });
    const fetchFile = vi.fn(async (_url: string) => bytes);

    const resolved = await ensureOcrModels({ modelDir, profile, fetchFile });

    expect(fetchFile).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(resolved.files["det.onnx"])).toEqual(bytes);

    await ensureOcrModels({ modelDir, profile, fetchFile });
    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it("rejects corrupt downloads", async () => {
    const profile = testProfile({ "det.onnx": "0".repeat(64) });

    await expect(
      ensureOcrModels({
        modelDir: tmpDir(),
        profile,
        fetchFile: async () => Buffer.from("wrong"),
      })
    ).rejects.toMatchObject({
      name: "OcrError",
      code: "OCR_MODEL_SHA256_MISMATCH",
    });
  });

  it("can skip sha256 verification for development mirrors", async () => {
    const modelDir = tmpDir();
    const bytes = Buffer.from("model-bytes");
    const profile = testProfile({ "det.onnx": "skip" });

    const resolved = await ensureOcrModels({
      modelDir,
      profile,
      fetchFile: async () => bytes,
    });

    expect(fs.readFileSync(resolved.files["det.onnx"])).toEqual(bytes);
  });

  it("falls back to mirror when origin download fails", async () => {
    const modelDir = tmpDir();
    const bytes = Buffer.from("model-bytes");
    const profile = {
      ...testProfile({ "det.onnx": "skip" }),
      files: [{ name: "det.onnx", url: "det.onnx", sha256: "skip" }],
    };
    const fetchFile = vi.fn(async (url: string) => {
      if (url.includes("huggingface.co")) throw new Error("origin blocked");
      return bytes;
    });

    const resolved = await ensureOcrModels({ modelDir, profile, fetchFile });

    expect(fetchFile.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("huggingface.co"),
      expect.stringContaining("hf-mirror.com"),
    ]);
    expect(fs.readFileSync(resolved.files["det.onnx"])).toEqual(bytes);
  });

  it("can force mirror downloads", async () => {
    const modelDir = tmpDir();
    const bytes = Buffer.from("model-bytes");
    const profile = {
      ...testProfile({ "det.onnx": "skip" }),
      files: [{ name: "det.onnx", url: "det.onnx", sha256: "skip" }],
    };
    const fetchFile = vi.fn(async (_url: string) => bytes);

    await ensureOcrModels({ modelDir, profile, fetchFile, modelSource: "mirror" });

    expect(fetchFile).toHaveBeenCalledTimes(1);
    expect(fetchFile.mock.calls[0][0]).toContain("hf-mirror.com");
  });

  it("resolves local model files without downloading or sha checks", () => {
    const modelDir = tmpDir();
    fs.writeFileSync(path.join(modelDir, "det.onnx"), "det");
    fs.writeFileSync(path.join(modelDir, "rec.onnx"), "rec");
    fs.writeFileSync(path.join(modelDir, "dict.txt"), "a\nb\n");

    const resolved = resolveLocalOcrModels({ modelDir });

    expect(resolved.files["det.onnx"]).toBe(path.join(modelDir, "det.onnx"));
    expect(resolved.files["rec.onnx"]).toBe(path.join(modelDir, "rec.onnx"));
    expect(resolved.files["dict.txt"]).toBe(path.join(modelDir, "dict.txt"));
  });

  it("writes downloaded model files atomically without leaving temp files", async () => {
    const modelDir = tmpDir();
    const bytes = Buffer.from("model-bytes");
    const profile = testProfile({ "det.onnx": "skip" });

    const resolved = await ensureOcrModels({
      modelDir,
      profile,
      fetchFile: async () => bytes,
    });

    expect(fs.readFileSync(resolved.files["det.onnx"])).toEqual(bytes);
    expect(fs.readdirSync(path.dirname(resolved.files["det.onnx"]))).toEqual([
      "det.onnx",
    ]);
  });
});

describe("OCR engine", () => {
  const image = {
    data: Buffer.alloc(40 * 40 * 4, 255),
    width: 40,
    height: 40,
  };

  function fakeEngine(lines: OcrTextLine[]): OcrEngine {
    return {
      read: vi.fn(async () => lines),
    };
  }

  it("adds origin and searchRegion offsets to text line boxes", async () => {
    const engine = fakeEngine([
      {
        text: "确定",
        score: 0.97,
        region: { left: 2, top: 3, width: 4, height: 5 },
        box: [
          { x: 2, y: 3 },
          { x: 6, y: 3 },
          { x: 6, y: 8 },
          { x: 2, y: 8 },
        ],
        center: { x: 4, y: 5 },
      },
    ]);
    const ocr = await createOcr({ engine });

    const lines = await ocr.read(image, {
      origin: { x: 100, y: 200 },
      searchRegion: { left: 10, top: 20, width: 20, height: 20 },
    });

    expect(engine.read).toHaveBeenCalledWith(
      expect.objectContaining({ width: 20, height: 20 })
    );
    expect(lines[0]).toEqual({
      text: "确定",
      score: 0.97,
      region: { left: 112, top: 223, width: 4, height: 5 },
      box: [
        { x: 112, y: 223 },
        { x: 116, y: 223 },
        { x: 116, y: 228 },
        { x: 112, y: 228 },
      ],
      center: { x: 114, y: 225 },
    });
  });

  it("findText defaults to contains matching and throws when missing", async () => {
    const ocr = await createOcr({
      engine: fakeEngine([
        {
          text: "发送消息",
          score: 0.9,
          region: { left: 0, top: 0, width: 20, height: 10 },
          box: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 10 },
            { x: 0, y: 10 },
          ],
          center: { x: 10, y: 5 },
        },
      ]),
    });

    await expect(ocr.findText(image, "消息")).resolves.toMatchObject({
      text: "发送消息",
    });
    await expect(ocr.findText(image, "missing")).rejects.toMatchObject({
      name: "OcrError",
      code: "OCR_TEXT_NOT_FOUND",
      context: { text: "missing" },
    });
  });

  it("findAllText supports exact and case sensitive matching", async () => {
    const ocr = await createOcr({
      engine: fakeEngine([
        {
          text: "OK",
          score: 0.8,
          region: { left: 0, top: 0, width: 1, height: 1 },
          box: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          center: { x: 0, y: 0 },
        },
        {
          text: "ok",
          score: 0.7,
          region: { left: 2, top: 0, width: 1, height: 1 },
          box: [
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 1 },
            { x: 2, y: 1 },
          ],
          center: { x: 2, y: 0 },
        },
      ]),
    });

    await expect(
      ocr.findAllText(image, "OK", { exact: true, caseSensitive: true })
    ).resolves.toHaveLength(1);
    await expect(
      ocr.findAllText(image, "OK", { exact: true, caseSensitive: false })
    ).resolves.toHaveLength(2);
  });

  it("findAllText supports similarity threshold matching", async () => {
    const ocr = await createOcr({
      engine: fakeEngine([
        {
          text: "Setting",
          score: 0.8,
          region: { left: 0, top: 0, width: 1, height: 1 },
          box: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          center: { x: 0, y: 0 },
        },
      ]),
    });

    await expect(
      ocr.findAllText(image, "Settings", { minSimilarity: 0.85 })
    ).resolves.toHaveLength(1);
    await expect(
      ocr.findAllText(image, "Settings", { minSimilarity: 0.95 })
    ).resolves.toHaveLength(0);
  });

  it("returns OCR text match metadata for matched lines", async () => {
    const ocr = await createOcr({
      engine: fakeEngine([
        {
          text: "Setting",
          score: 0.8,
          region: { left: 0, top: 0, width: 1, height: 1 },
          box: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          center: { x: 0, y: 0 },
        },
      ]),
    });

    const matches = await ocr.findAllText(image, "Settings", {
      minSimilarity: 0.85,
    });

    expect(matches[0]).toMatchObject({
      text: "Setting",
      score: 0.8,
      query: "Settings",
      matched: true,
      matchAlgorithm: "ocr-text",
      matchKind: "similarity",
      matchScore: 0.875,
    });
  });

  it("scores OCR text candidates without running OCR", () => {
    expect(scoreOcrText("Settings", "Settings", { exact: true })).toEqual({
      query: "Settings",
      matched: true,
      matchAlgorithm: "ocr-text",
      matchKind: "exact",
      matchScore: 1,
    });
    expect(scoreOcrText("Setting", "Settings", { minSimilarity: 0.95 })).toEqual({
      query: "Settings",
      matched: false,
      matchAlgorithm: "ocr-text",
      matchKind: "similarity",
      matchScore: 0.875,
    });
    expect(scoreOcrText("Cancel", "Send")).toEqual({
      query: "Send",
      matched: false,
      matchAlgorithm: "ocr-text",
      matchKind: "none",
      matchScore: 0,
    });
  });

  it("rejects malformed CaptureImage input before OCR", async () => {
    const ocr = await createOcr({ engine: fakeEngine([]) });

    await expect(
      ocr.read({ data: Buffer.alloc(3), width: 2, height: 2 })
    ).rejects.toMatchObject({
      name: "OcrError",
      code: "OCR_IMAGE_INVALID",
    });
  });

  it("passes valid CaptureImage Buffer input through without copying", async () => {
    const source = {
      data: Buffer.alloc(4 * 4 * 4, 255),
      width: 4,
      height: 4,
    };
    const engine = fakeEngine([]);
    const ocr = await createOcr({ engine });

    await ocr.read(source);

    expect(vi.mocked(engine.read).mock.calls[0][0].data).toBe(source.data);
  });

  it("rejects empty searchRegion before OCR", async () => {
    const ocr = await createOcr({ engine: fakeEngine([]) });

    await expect(
      ocr.read(image, { searchRegion: { left: 0, top: 0, width: 0, height: 10 } })
    ).rejects.toThrow(/searchRegion/i);
  });

  it("applies OCR preprocessing before engine reads the image", async () => {
    const engine = fakeEngine([]);
    const ocr = await createOcr({
      engine,
      preprocess: {
        scale: 2,
        grayscale: true,
        normalize: true,
        sharpen: true,
      },
    });

    await ocr.read({
      data: Buffer.from([
        10, 20, 30, 255,
        200, 210, 220, 255,
        40, 50, 60, 255,
        240, 250, 255, 255,
      ]),
      width: 2,
      height: 2,
    });

    const prepared = vi.mocked(engine.read).mock.calls[0][0];
    expect(prepared.width).toBe(4);
    expect(prepared.height).toBe(4);
    expect(prepared.data).toHaveLength(4 * 4 * 4);
    expect(prepared.data[0]).toBe(prepared.data[1]);
    expect(prepared.data[1]).toBe(prepared.data[2]);
  });
});

describe("image helpers", () => {
  it("rejects invalid CaptureImage dimensions and pixel length", async () => {
    await expect(loadImage({ data: Buffer.alloc(4), width: 0, height: 1 })).rejects.toThrow(
      /width/i
    );
    await expect(loadImage({ data: Buffer.alloc(4), width: 2, height: 1 })).rejects.toThrow(
      /rgba/i
    );
  });

  it("rejects non-finite and non-positive crop regions", () => {
    expect(() =>
      validateRegion(
        { left: Number.NaN, top: 0, width: 1, height: 1 },
        "region"
      )
    ).toThrow(/finite/i);
    expect(() =>
      validateRegion({ left: 0, top: 0, width: -1, height: 1 }, "region")
    ).toThrow(/width/i);
  });

  it("clips overlapping crop regions to the source image", () => {
    const source = {
      data: Buffer.alloc(4 * 4 * 4, 255),
      width: 4,
      height: 4,
    };

    const cropped = cropImage(source, { left: -2, top: -1, width: 4, height: 3 });

    expect(cropped.width).toBe(2);
    expect(cropped.height).toBe(2);
    expect(cropped.data).toHaveLength(2 * 2 * 4);
  });

  it("rejects crop regions that do not overlap the image", () => {
    expect(() =>
      cropImage(
        { data: Buffer.alloc(4 * 4 * 4), width: 4, height: 4 },
        { left: 10, top: 10, width: 2, height: 2 }
      )
    ).toThrow(/outside image/i);
  });

  it("rejects malformed images before resize", async () => {
    await expect(
      resizeRgba({ data: Buffer.alloc(3), width: 1, height: 1 }, 2, 2)
    ).rejects.toThrow(/rgba/i);
  });
});

describe("helpers used by the ONNX pipeline", () => {
  it("decodes CTC logits with duplicate and blank removal", async () => {
    const { decodeCtc } = await import("./postprocess");
    const text = decodeCtc(
      [
        [0.1, 0.8, 0.1],
        [0.1, 0.7, 0.2],
        [0.9, 0.05, 0.05],
        [0.1, 0.1, 0.8],
      ],
      ["a", "b"]
    );

    expect(text).toEqual({ text: "ab", score: expect.closeTo(0.8, 5) });
  });

  it("extracts one bounding box from a DB probability map", async () => {
    const { boxesFromBitmap } = await import("./postprocess");
    const boxes = boxesFromBitmap(
      [
        0, 0, 0, 0,
        0, 1, 1, 0,
        0, 1, 1, 0,
        0, 0, 0, 0,
      ],
      4,
      4,
      0.3
    );

    expect(boxes).toEqual([
      {
        region: { left: 1, top: 1, width: 2, height: 2 },
        box: [
          { x: 1, y: 1 },
          { x: 3, y: 1 },
          { x: 3, y: 3 },
          { x: 1, y: 3 },
        ],
        score: 1,
      },
    ]);
  });

  it("returns a rotated four-point box for slanted DB components", async () => {
    const { boxesFromBitmap } = await import("./postprocess");
    const width = 24;
    const height = 16;
    const bitmap = Array(width * height).fill(0);

    for (let x = 2; x <= 18; x++) {
      const y = Math.floor(x / 2);
      for (let dy = 0; dy < 3; dy++) {
        bitmap[(y + dy) * width + x] = 0.95;
        bitmap[(y + dy) * width + x + 1] = 0.95;
      }
    }

    const [box] = boxesFromBitmap(bitmap, width, height, 0.3);

    expect(box.region).toEqual({ left: 2, top: 1, width: 18, height: 11 });
    expect(box.box).not.toEqual([
      { x: 2, y: 1 },
      { x: 20, y: 1 },
      { x: 20, y: 12 },
      { x: 2, y: 12 },
    ]);
    expect(box.box.some((point) => point.y !== 1 && point.y !== 12)).toBe(true);
    expect(new Set(box.box.map((point) => point.x)).size).toBeGreaterThan(2);
  });
});
