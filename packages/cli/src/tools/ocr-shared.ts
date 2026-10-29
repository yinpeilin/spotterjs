import { scoreOcrText, type OcrTextLine, type OcrTextMatch } from "@spotterjs/plugin-ocr";
import type { Point, TextMatchEvaluation } from "@spotterjs/base";
import { z } from "zod";
import type { DebugAnnotation } from "../adapters/debug-draw.js";

export const ocrModelProfileSchema = z
  .enum(["server", "mobile", "ppocrv5-server", "ppocrv5-mobile"])
  .describe("Built-in OCR model profile to load.");

export type OcrModelProfileName = z.infer<typeof ocrModelProfileSchema>;

export const ocrModelOptionsSchema = {
  modelDir: z
    .string()
    .optional()
    .describe("Directory for OCR model files. Omit to use the default model cache."),
  modelProfile: ocrModelProfileSchema
    .optional()
    .describe("Built-in OCR model profile. Use mobile for smaller models or server for higher accuracy."),
};

export type OcrModelOptions = {
  modelDir?: string;
  modelProfile?: OcrModelProfileName;
};

export type ScoredOcrTextLine = OcrTextLine & TextMatchEvaluation;

const ocrClients = new Map<string, Promise<import("@spotterjs/plugin-ocr").OcrClient>>();
let createOcrIdentity: unknown;

export async function getOcr(args: OcrModelOptions) {
  const { createOcr } = await import("@spotterjs/plugin-ocr");
  if (createOcrIdentity !== createOcr) {
    ocrClients.clear();
    createOcrIdentity = createOcr;
  }
  const key = JSON.stringify({
    modelDir: args.modelDir,
    modelProfile: args.modelProfile,
  });
  let client = ocrClients.get(key);
  if (!client) {
    client = createOcr({
      modelDir: args.modelDir,
      modelProfile: args.modelProfile,
    });
    ocrClients.set(key, client);
  }
  return client;
}

export function scoreOcrLines(
  lines: OcrTextLine[],
  text: string,
  options: {
    exact?: boolean;
    caseSensitive?: boolean;
    minSimilarity?: number;
  } = {}
): ScoredOcrTextLine[] {
  return lines.map((line) => ({
    ...line,
    ...scoreOcrText(line.text, text, options),
  }));
}

export function matchingOcrLines(lines: ScoredOcrTextLine[]): OcrTextMatch[] {
  return lines.filter((line): line is OcrTextMatch => line.matched);
}

export function ocrLineAnnotations(lines: OcrTextLine[]): DebugAnnotation[] {
  const annotations: DebugAnnotation[] = [];
  for (const line of lines) {
    if (hasBox(line.box)) {
      annotations.push({ kind: "polygon", points: line.box });
    } else if (line.region) {
      annotations.push({ kind: "region", region: line.region });
    }
    if (isPoint(line.center)) {
      annotations.push({ kind: "point", point: line.center });
    }
  }
  return annotations;
}

function hasBox(value: unknown): value is [Point, Point, Point, Point] {
  return Array.isArray(value) && value.length === 4 && value.every(isPoint);
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    Number.isFinite((value as Point).x) &&
    Number.isFinite((value as Point).y)
  );
}
