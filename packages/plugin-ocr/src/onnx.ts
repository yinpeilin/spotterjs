import * as fs from "fs";
import type { CaptureImage } from "@spotterjs/base";
import { cropImage, resizeRgba } from "./image";
import { centerOf, boxesFromBitmap, type DetectedBox } from "./postprocess";
import type {
  OcrEngine,
  OcrModelProfile,
  OcrSession,
  OcrTextLine,
  ResolvedOcrModels,
} from "./types";

type OrtModule = {
  InferenceSession: {
    create(path: string): Promise<OcrSession>;
  };
  Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown;
};

export async function createOnnxOcrEngine(models: ResolvedOcrModels): Promise<OcrEngine> {
  const ort = (await import("onnxruntime-node")) as OrtModule;
  const det = await ort.InferenceSession.create(
    models.files[models.profile.detection.modelFile]
  );
  const rec = await ort.InferenceSession.create(
    models.files[models.profile.recognition.modelFile]
  );
  const dictionary = fs
    .readFileSync(models.files[models.profile.recognition.dictionaryFile], "utf8")
    .split(/\r?\n/)
    .filter(Boolean);

  return new OnnxOcrEngine(ort, models.profile, det, rec, dictionary);
}

class OnnxOcrEngine implements OcrEngine {
  constructor(
    private readonly ort: OrtModule,
    private readonly profile: OcrModelProfile,
    private readonly detector: OcrSession,
    private readonly recognizer: OcrSession,
    private readonly dictionary: string[]
  ) {}

  async read(image: CaptureImage): Promise<OcrTextLine[]> {
    const boxes = await this.detect(image);
    const lines: OcrTextLine[] = [];

    for (const box of boxes) {
      const crop = cropImage(image, box.region);
      const rec = await this.recognize(crop);
      if (!rec.text) continue;
      lines.push({
        text: rec.text,
        score: (rec.score + box.score) / 2,
        region: box.region,
        box: box.box,
        center: centerOf(box.region),
      });
    }

    return lines;
  }

  private async detect(image: CaptureImage): Promise<DetectedBox[]> {
    const cfg = this.profile.detection;
    const resized = await resizeRgba(image, cfg.inputWidth, cfg.inputHeight);
    const input = rgbaToNchw(resized, cfg.mean, cfg.std);
    const inputName = cfg.inputName ?? this.detector.inputNames?.[0] ?? "x";
    const feeds = { [inputName]: new this.ort.Tensor("float32", input, [1, 3, cfg.inputHeight, cfg.inputWidth]) };
    const output = firstTensor(await this.detector.run(feeds));
    const bitmap = output.data as Float32Array;
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
    const data = Array.from(output.data as Float32Array);
    const dims = output.dims as number[];
    const classes = dims[dims.length - 1];
    const steps = data.length / classes;
    const rows: number[][] = [];
    const { decodeCtc } = await import("./postprocess");

    for (let i = 0; i < steps; i++) {
      rows.push(data.slice(i * classes, (i + 1) * classes));
    }

    return decodeCtc(rows, this.dictionary);
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
    throw new Error("ONNX session returned no tensor output");
  }
  return first as { data: unknown; dims: number[] };
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
