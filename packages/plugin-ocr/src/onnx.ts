import * as fs from "fs";
import type { CaptureImage } from "@spotterjs/base";
import { OcrError } from "./errors";
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
    const resized = await resizeRgba(image, cfg.inputWidth, cfg.inputHeight);
    const input = rgbaToNchw(resized, cfg.mean, cfg.std);
    const inputName = cfg.inputName ?? this.detector.inputNames?.[0] ?? "x";
    const feeds = { [inputName]: new this.ort.Tensor("float32", input, [1, 3, cfg.inputHeight, cfg.inputWidth]) };
    const output = firstTensor(await this.detector.run(feeds));
    const bitmap = tensorData(output, "detection");
    const boxes = boxesFromBitmap(bitmap, cfg.inputWidth, cfg.inputHeight, cfg.boxThreshold);
    const scaleX = image.width / cfg.inputWidth;
    const scaleY = image.height / cfg.inputHeight;

    return boxes.map((box) => scaleBox(box, scaleX, scaleY));
  }

  private async recognize(image: CaptureImage): Promise<{ text: string; score: number }> {
    const cfg = this.profile.recognition;
    const resized = await resizeRgba(image, cfg.inputWidth, cfg.inputHeight);
    const input = rgbaToNchw(resized, cfg.mean, cfg.std);
    const inputName = cfg.inputName ?? this.recognizer.inputNames?.[0] ?? "x";
    const feeds = { [inputName]: new this.ort.Tensor("float32", input, [1, 3, cfg.inputHeight, cfg.inputWidth]) };
    const output = firstTensor(await this.recognizer.run(feeds));
    const data = tensorData(output, "recognition");
    const dims = output.dims as number[];
    const classes = dims[dims.length - 1];
    if (!Number.isInteger(classes) || classes <= 0 || data.length % classes !== 0) {
      throw new OcrError(
        "OCR_ONNX_INVALID_OUTPUT",
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
  std: [number, number, number]
): Float32Array {
  const pixels = image.width * image.height;
  const out = new Float32Array(pixels * 3);

  for (let i = 0; i < pixels; i++) {
    const r = image.data[i * 4] / 255;
    const g = image.data[i * 4 + 1] / 255;
    const b = image.data[i * 4 + 2] / 255;
    out[i] = (r - mean[0]) / std[0];
    out[pixels + i] = (g - mean[1]) / std[1];
    out[pixels * 2 + i] = (b - mean[2]) / std[2];
  }

  return out;
}

function firstTensor(outputs: Record<string, unknown>): { data: unknown; dims: number[] } {
  const first = Object.values(outputs)[0] as { data?: unknown; dims?: number[] } | undefined;
  if (!first?.data || !first.dims) {
    throw new OcrError("OCR_ONNX_INVALID_OUTPUT", "ONNX session returned no tensor output", {
      context: { outputNames: Object.keys(outputs) },
    });
  }
  return first as { data: unknown; dims: number[] };
}

function tensorData(output: { data: unknown; dims: number[] }, label: string): Float32Array {
  if (!(output.data instanceof Float32Array)) {
    throw new OcrError(
      "OCR_ONNX_INVALID_OUTPUT",
      `ONNX ${label} output data must be Float32Array`,
      { context: { label, dataType: typeof output.data } }
    );
  }
  if (!output.dims.every((dim) => Number.isInteger(dim) && dim > 0)) {
    throw new OcrError(
      "OCR_ONNX_INVALID_OUTPUT",
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

function scaleBox(box: DetectedBox, scaleX: number, scaleY: number): DetectedBox {
  const left = Math.round(box.region.left * scaleX);
  const top = Math.round(box.region.top * scaleY);
  const width = Math.max(1, Math.round(box.region.width * scaleX));
  const height = Math.max(1, Math.round(box.region.height * scaleY));
  const region = { left, top, width, height };

  return {
    score: box.score,
    region,
    box: box.box.map((p) => ({
      x: Math.round(p.x * scaleX),
      y: Math.round(p.y * scaleY),
    })) as DetectedBox["box"],
  };
}
