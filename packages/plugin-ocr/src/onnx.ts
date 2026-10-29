import * as fs from "fs";
import type { CaptureImage } from "@spotterjs/base";
import { ocrError } from "./errors";
import { cropImage, resizeRgba } from "./image";
import { centerOf, boxesFromBitmap, type DetectedBox } from "./postprocess";
import type {
  OcrExecutionProvider,
  OcrEngine,
  OcrModelProfile,
  OcrSession,
  OcrTextLine,
  ResolvedOcrModels,
} from "./types";

type OrtModule = {
  InferenceSession: {
    create(
      path: string,
      options?: { executionProviders?: readonly OcrExecutionProvider[] }
    ): Promise<OcrSession>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

const DB_UNCLIP_RATIO = 1.5;

export async function createOnnxOcrEngine(
  models: ResolvedOcrModels,
  options: {
    recognitionConcurrency?: number;
    executionProviders?: readonly OcrExecutionProvider[];
  } = {}
): Promise<OcrEngine> {
  const ort = (await import("onnxruntime-node")) as OrtModule;
  const sessionOptions = options.executionProviders
    ? { executionProviders: options.executionProviders }
    : undefined;
  const det = await ort.InferenceSession.create(
    models.files[models.profile.detection.modelFile],
    sessionOptions
  );
  const rec = await ort.InferenceSession.create(
    models.files[models.profile.recognition.modelFile],
    sessionOptions
  );
  const dictionary = fs
    .readFileSync(models.files[models.profile.recognition.dictionaryFile], "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  return new OnnxOcrEngine(
    ort,
    models.profile,
    det,
    rec,
    dictionary,
    options.recognitionConcurrency ?? 2
  );
}

class OnnxOcrEngine implements OcrEngine {
  constructor(
    private readonly ort: OrtModule,
    private readonly profile: OcrModelProfile,
    private readonly detector: OcrSession,
    private readonly recognizer: OcrSession,
    private readonly dictionary: string[],
    private readonly recognitionConcurrency: number
  ) {}

  async read(image: CaptureImage): Promise<OcrTextLine[]> {
    const boxes = await this.detect(image);
    const lines = await mapLimit(boxes, this.recognitionConcurrency, async (box) => {
      const crop = cropImage(image, box.region);
      const rec = await this.recognize(crop);
      if (!rec.text) return undefined;
      return {
        text: rec.text,
        score: (rec.score + box.score) / 2,
        region: box.region,
        box: box.box,
        center: centerOf(box.region),
      };
    });

    return lines.filter((line): line is OcrTextLine => Boolean(line));
  }

  private async detect(image: CaptureImage): Promise<DetectedBox[]> {
    const cfg = this.profile.detection;
    // Keep the text shape while still accepting models with a fixed input size.
    const ratio = Math.min(cfg.inputWidth / image.width, cfg.inputHeight / image.height);
    const width = Math.max(1, Math.min(cfg.inputWidth, Math.round(image.width * ratio)));
    const height = Math.max(1, Math.min(cfg.inputHeight, Math.round(image.height * ratio)));
    const resized = await resizeRgba(image, width, height);
    const padded = Buffer.alloc(cfg.inputWidth * cfg.inputHeight * 4, 255);
    for (let y = 0; y < height; y++) {
      resized.data.copy(padded, y * cfg.inputWidth * 4, y * width * 4, (y + 1) * width * 4);
    }
    const input = rgbaToNchw({ data: padded, width: cfg.inputWidth, height: cfg.inputHeight }, cfg.mean, cfg.std);
    const inputName = cfg.inputName ?? this.detector.inputNames?.[0] ?? "x";
    const feeds = { [inputName]: new this.ort.Tensor("float32", input, [1, 3, cfg.inputHeight, cfg.inputWidth]) };
    const output = firstTensor(await this.detector.run(feeds));
    const bitmap = tensorData(output, "detection");
    const dims = output.dims;
    if (dims.length < 2 || dims.slice(0, -2).some((dim) => dim !== 1) ||
        dims.reduce((size, dim) => size * dim, 1) !== bitmap.length) {
      throw ocrError("SPOTTER_OCR_ONNX_INVALID_OUTPUT", "ONNX detection output must contain one probability map", {
        context: { label: "detection", dims, dataLength: bitmap.length },
      });
    }
    const mapWidth = dims[dims.length - 1];
    const mapHeight = dims[dims.length - 2];
    const boxes = boxesFromBitmap(bitmap, mapWidth, mapHeight, cfg.boxThreshold);
    const scaleX = cfg.inputWidth / mapWidth * image.width / width;
    const scaleY = cfg.inputHeight / mapHeight * image.height / height;

    return boxes
      .filter((box) => box.region.left * scaleX < image.width && box.region.top * scaleY < image.height)
      .map((box) => scaleBox(expandTextBox(box), scaleX, scaleY, image));
  }

  private async recognize(image: CaptureImage): Promise<{ text: string; score: number }> {
    const cfg = this.profile.recognition;
    const width = Math.max(1, Math.min(cfg.inputWidth, Math.ceil(cfg.inputHeight * image.width / image.height)));
    const resized = await resizeRgba(image, width, cfg.inputHeight);
    // Paddle recognition pads AFTER normalization, so unused columns are zero.
    const input = rgbaToNchw(resized, cfg.mean, cfg.std, cfg.inputWidth);
    const inputName = cfg.inputName ?? this.recognizer.inputNames?.[0] ?? "x";
    const feeds = { [inputName]: new this.ort.Tensor("float32", input, [1, 3, cfg.inputHeight, cfg.inputWidth]) };
    const output = firstTensor(await this.recognizer.run(feeds));
    const data = tensorData(output, "recognition");
    const dims = output.dims as number[];
    const classes = dims[dims.length - 1];
    if (!Number.isInteger(classes) || classes <= 0 || data.length % classes !== 0) {
      throw ocrError(
        "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
        `ONNX recognition output has invalid shape: ${dims.join("x")}`,
        { context: { label: "recognition", dims, dataLength: data.length } }
      );
    }
    const steps = data.length / classes;
    return decodeCtcFlat(data, steps, classes, this.dictionary);
  }
}

function rgbaToNchw(
  image: CaptureImage,
  mean: [number, number, number],
  std: [number, number, number],
  paddedWidth = image.width
): Float32Array {
  const pixels = image.width * image.height;
  const plane = paddedWidth * image.height;
  const out = new Float32Array(plane * 3);

  for (let i = 0; i < pixels; i++) {
    const r = image.data[i * 4] / 255;
    const g = image.data[i * 4 + 1] / 255;
    const b = image.data[i * 4 + 2] / 255;
    const target = Math.floor(i / image.width) * paddedWidth + i % image.width;
    out[target] = (r - mean[0]) / std[0];
    out[plane + target] = (g - mean[1]) / std[1];
    out[plane * 2 + target] = (b - mean[2]) / std[2];
  }

  return out;
}

function firstTensor(outputs: Record<string, unknown>): { data: unknown; dims: number[] } {
  const first = Object.values(outputs)[0] as { data?: unknown; dims?: number[] } | undefined;
  if (!first?.data || !first.dims) {
    throw ocrError("SPOTTER_OCR_ONNX_INVALID_OUTPUT", "ONNX session returned no tensor output", {
      context: { outputNames: Object.keys(outputs) },
    });
  }
  return first as { data: unknown; dims: number[] };
}

function tensorData(output: { data: unknown; dims: number[] }, label: string): Float32Array {
  if (!(output.data instanceof Float32Array)) {
    throw ocrError(
      "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      `ONNX ${label} output data must be Float32Array`,
      { context: { label, dataType: typeof output.data } }
    );
  }
  if (!output.dims.every((dim) => Number.isInteger(dim) && dim > 0)) {
    throw ocrError(
      "SPOTTER_OCR_ONNX_INVALID_OUTPUT",
      `ONNX ${label} output has invalid shape: ${output.dims.join("x")}`,
      { context: { label, dims: output.dims } }
    );
  }
  return output.data;
}

function decodeCtcFlat(
  logits: Float32Array,
  steps: number,
  classes: number,
  dictionary: string[]
): { text: string; score: number } {
  const chars: string[] = [];
  let scoreSum = 0;
  let scoreCount = 0;
  let previous = -1;

  for (let step = 0; step < steps; step++) {
    const offset = step * classes;
    let best = 0;
    for (let i = 1; i < classes; i++) {
      if (logits[offset + i] > logits[offset + best]) best = i;
    }
    if (best !== 0 && best !== previous) {
      chars.push(dictionary[best - 1] ?? "");
      scoreSum += logits[offset + best];
      scoreCount++;
    }
    previous = best;
  }

  return { text: chars.join(""), score: scoreCount ? scoreSum / scoreCount : 0 };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Restore the DB text kernel using Paddle's area * unclipRatio / perimeter offset.
 * https://github.com/PaddlePaddle/PaddleOCR/blob/main/ppocr/postprocess/db_postprocess.py
 */
function expandTextBox(box: DetectedBox): DetectedBox {
  const points = box.box;
  let twiceArea = 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twiceArea += a.x * b.y - b.x * a.y;
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const distance = perimeter ? Math.abs(twiceArea) / 2 * DB_UNCLIP_RATIO / perimeter : 0;
  const expanded = points.map((point, i) => {
    const before = points[(i + points.length - 1) % points.length];
    const after = points[(i + 1) % points.length];
    const beforeLength = Math.hypot(point.x - before.x, point.y - before.y) || 1;
    const afterLength = Math.hypot(point.x - after.x, point.y - after.y) || 1;
    return {
      x: point.x + distance * ((point.x - before.x) / beforeLength + (point.x - after.x) / afterLength),
      y: point.y + distance * ((point.y - before.y) / beforeLength + (point.y - after.y) / afterLength),
    };
  }) as DetectedBox["box"];
  return { ...box, box: expanded };
}

function scaleBox(box: DetectedBox, scaleX: number, scaleY: number, image: CaptureImage): DetectedBox {
  const points = box.box.map((p) => ({
    x: Math.max(0, Math.min(image.width, Math.round(p.x * scaleX))),
    y: Math.max(0, Math.min(image.height, Math.round(p.y * scaleY))),
  })) as DetectedBox["box"];
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  const region = { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };

  return {
    score: box.score,
    region,
    box: points,
  };
}
