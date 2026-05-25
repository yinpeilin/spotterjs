import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const regionSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

const readOptionsSchema = {
  searchRegion: regionSchema.optional(),
  origin: z.object({ x: z.number(), y: z.number() }).optional(),
};

const modelOptionsSchema = {
  modelDir: z.string().optional(),
  modelProfile: z.enum(["server", "mobile", "ppocrv5-server", "ppocrv5-mobile"]).optional(),
};

function errorResult(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
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
        const { createOcr } = await import("@spotterjs/plugin-ocr");
        const ocr = await createOcr({
          modelDir: args.modelDir,
          modelProfile: args.modelProfile,
        });
        return json({
          imagePath: args.imagePath,
          lines: await ocr.read(args.imagePath, {
            searchRegion: args.searchRegion,
            origin: args.origin,
          }),
        });
      } catch (error) {
        return errorResult(error);
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
        const { createOcr } = await import("@spotterjs/plugin-ocr");
        const ocr = await createOcr({
          modelDir: args.modelDir,
          modelProfile: args.modelProfile,
        });
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
        return errorResult(error);
      }
    }
  );
}
