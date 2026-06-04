import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { scoreOcrText, type OcrTextLine, type OcrTextMatch } from "@spotterjs/plugin-ocr";
import type { Point } from "@spotterjs/base";
import { z } from "zod";
import {
  type DebugAnnotation,
  writeDebugImageFromPath,
} from "../adapters/debug-draw.js";
import { json, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const normalizedNumber = finiteNumber.min(0).max(1);

const regionSchema = z.object({
  left: finiteNumber,
  top: finiteNumber,
  width: positiveNumber,
  height: positiveNumber,
});

const readOptionsSchema = {
  searchRegion: regionSchema.optional(),
  origin: z.object({ x: finiteNumber, y: finiteNumber }).optional(),
  debugImage: z.boolean().optional(),
};

const modelOptionsSchema = {
  modelDir: z.string().optional(),
  modelProfile: z.enum(["server", "mobile", "ppocrv5-server", "ppocrv5-mobile"]).optional(),
};

const ocrClients = new Map<string, Promise<import("@spotterjs/plugin-ocr").OcrClient>>();
let createOcrIdentity: unknown;

async function getOcr(args: { modelDir?: string; modelProfile?: "server" | "mobile" | "ppocrv5-server" | "ppocrv5-mobile" }) {
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

export function registerOcrTools(server: McpServer): void {
  registerSafeTool(
    server,
    "ocr_read_image",
    {
      description:
        "Read text lines from a workspace image path using OCR. Use this after capture tools return imagePath.",
      inputSchema: z
        .object({
          imagePath: z.string(),
          ...readOptionsSchema,
          ...modelOptionsSchema,
        })
        .shape,
    },
    async (args) => {
      const ocr = await getOcr(args);
      const lines = await ocr.read(args.imagePath, {
        searchRegion: args.searchRegion,
        origin: args.origin,
      });
      const debug = args.debugImage
        ? writeDebugImageFromPath(args.imagePath, ocrLineAnnotations(lines), {
            prefix: "ocr-read-image-debug",
            origin: args.origin,
          })
        : undefined;
      return json({
        imagePath: args.imagePath,
        lines,
        ...(debug ? { debugImagePath: debug.imagePath } : {}),
      });
    }
  );

  registerSafeTool(
    server,
    "ocr_find_text",
    {
      description:
        "Find text in a workspace image path using OCR. Returns matching OCR lines and image coordinate boxes.",
      inputSchema: z
        .object({
          imagePath: z.string(),
          text: z.string(),
          exact: z.boolean().optional(),
          caseSensitive: z.boolean().optional(),
          minSimilarity: normalizedNumber.optional(),
          ...readOptionsSchema,
          ...modelOptionsSchema,
        })
        .shape,
    },
    async (args) => {
      const ocr = await getOcr(args);
      if (args.debugImage) {
        const lines = await ocr.read(args.imagePath, {
          searchRegion: args.searchRegion,
          origin: args.origin,
        });
        const candidates = lines.map((line) => ({
          ...line,
          ...scoreOcrText(line.text, args.text, {
            exact: args.exact,
            caseSensitive: args.caseSensitive,
            minSimilarity: args.minSimilarity,
          }),
        }));
        const matches = candidates.filter((line): line is OcrTextMatch => line.matched);
        const debug = writeDebugImageFromPath(
          args.imagePath,
          ocrLineAnnotations(candidates),
          {
            prefix: "ocr-find-text-debug",
            origin: args.origin,
          }
        );
        return json({
          imagePath: args.imagePath,
          matches,
          candidates,
          debugImagePath: debug.imagePath,
        });
      }

      return json({
        imagePath: args.imagePath,
        matches: await ocr.findAllText(args.imagePath, args.text, {
          exact: args.exact,
          caseSensitive: args.caseSensitive,
          minSimilarity: args.minSimilarity,
          searchRegion: args.searchRegion,
          origin: args.origin,
        }),
      });
    }
  );
}

function ocrLineAnnotations(lines: OcrTextLine[]): DebugAnnotation[] {
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
