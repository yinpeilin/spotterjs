import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, json } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();

const regionSchema = z.object({
  left: finiteNumber,
  top: finiteNumber,
  width: positiveNumber,
  height: positiveNumber,
});

const readOptionsSchema = {
  searchRegion: regionSchema.optional(),
  origin: z.object({ x: finiteNumber, y: finiteNumber }).optional(),
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
  server.registerTool(
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
      try {
        const ocr = await getOcr(args);
        return json({
          imagePath: args.imagePath,
          lines: await ocr.read(args.imagePath, {
            searchRegion: args.searchRegion,
            origin: args.origin,
          }),
        });
      } catch (error) {
        return errorResult("ocr_read_image", error);
      }
    }
  );

  server.registerTool(
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
          ...readOptionsSchema,
          ...modelOptionsSchema,
        })
        .shape,
    },
    async (args) => {
      try {
        const ocr = await getOcr(args);
        return json({
          imagePath: args.imagePath,
          matches: await ocr.findAllText(args.imagePath, args.text, {
            exact: args.exact,
            caseSensitive: args.caseSensitive,
            searchRegion: args.searchRegion,
            origin: args.origin,
          }),
        });
      } catch (error) {
        return errorResult("ocr_find_text", error);
      }
    }
  );
}
