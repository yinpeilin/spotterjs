import type { CommandRegistry } from "../registry.js";
import { z } from "zod";
import { resolveImagePath } from "../paths.js";
import {
  debugImageField,
  writeDebugImageFromPath,
} from "../adapters/debug-draw.js";
import {
  getOcr,
  matchingOcrLines,
  ocrLineAnnotations,
  ocrModelOptionsSchema,
  scoreOcrLines,
} from "./ocr-shared.js";
import { json, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const normalizedNumber = finiteNumber.min(0).max(1);

const regionSchema = z.object({
  left: finiteNumber.describe("Image x coordinate of the search region left edge."),
  top: finiteNumber.describe("Image y coordinate of the search region top edge."),
  width: positiveNumber.describe("Search region width in pixels."),
  height: positiveNumber.describe("Search region height in pixels."),
});

const readOptionsSchema = {
  searchRegion: regionSchema
    .optional()
    .describe("Optional crop inside the input image before OCR."),
  origin: z
    .object({
      x: finiteNumber.describe("X offset added to OCR result coordinates."),
      y: finiteNumber.describe("Y offset added to OCR result coordinates."),
    })
    .optional()
    .describe("Coordinate offset used to translate cropped image results back to screen space."),
  ...debugImageField,
};

export function registerOcrTools(server: CommandRegistry): void {
  registerSafeTool(
    server,
    "ocr_read_image",
    {
      description:
        "Read text lines from a workspace image path using OCR. Use this after capture tools return imagePath.",
      inputSchema: z
        .object({
          imagePath: z.string().describe("Workspace image path returned by a capture tool."),
          ...readOptionsSchema,
          ...ocrModelOptionsSchema,
        })
        .shape,
    },
    async (args) => {
      const imagePath = resolveImagePath(args.imagePath);
      const ocr = await getOcr(args);
      const lines = await ocr.read(imagePath, {
        searchRegion: args.searchRegion,
        origin: args.origin,
      });
      const debug = args.debugImage
        ? writeDebugImageFromPath(imagePath, ocrLineAnnotations(lines), {
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
          imagePath: z.string().describe("Workspace image path returned by a capture tool."),
          text: z.string().describe("Text to find in OCR output."),
          exact: z
            .boolean()
            .optional()
            .describe("Require exact OCR text equality instead of substring matching."),
          caseSensitive: z
            .boolean()
            .optional()
            .describe("Preserve case when comparing OCR text."),
          minSimilarity: normalizedNumber
            .optional()
            .describe("Minimum normalized OCR text similarity for fuzzy matching."),
          ...readOptionsSchema,
          ...ocrModelOptionsSchema,
        })
        .shape,
    },
    async (args) => {
      const imagePath = resolveImagePath(args.imagePath);
      const ocr = await getOcr(args);
      if (args.debugImage) {
        const lines = await ocr.read(imagePath, {
          searchRegion: args.searchRegion,
          origin: args.origin,
        });
        const candidates = scoreOcrLines(lines, args.text, {
          exact: args.exact,
          caseSensitive: args.caseSensitive,
          minSimilarity: args.minSimilarity,
        });
        const matches = matchingOcrLines(candidates);
        const debug = writeDebugImageFromPath(
          imagePath,
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
        matches: await ocr.findAllText(imagePath, args.text, {
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
