import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  image as coreImage,
  mouse,
  screen,
  windows,
} from "@spotterjs/core";
import type {
  CaptureImage,
  MatchResult,
  Point,
  Region,
  Rgb,
} from "@spotterjs/base";
import { z } from "zod";
import {
  type CaptureArtifact,
  type CaptureArtifactDetail,
  workspaceImageStore,
} from "../adapters/artifacts.js";
import {
  type DebugAnnotation,
  debugImageField,
  debugImagePatch,
  matchAnnotations,
  offsetAnnotations,
  writeDebugCapture,
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
const captureDetailSchema = z
  .enum(["high", "original"])
  .default("original")
  .describe(
    'Artifact detail. Combo tools default to "original" so returned screen coordinates line up with saved pixels.'
  );

const regionSchema = z
  .object({
    left: finiteNumber.describe("Screen x coordinate of the capture region left edge."),
    top: finiteNumber.describe("Screen y coordinate of the capture region top edge."),
    width: positiveNumber.describe("Capture region width in pixels."),
    height: positiveNumber.describe("Capture region height in pixels."),
  })
  .optional()
  .describe("Screen capture region. Only applies when source is screen.");

const sourceSchema = z
  .enum(["screen", "active", "window"])
  .default("screen")
  .describe("Desktop capture source: full screen/region, foreground window, or a specific window.");

const debugImageSchema = debugImageField.debugImage;

const matchOptionsSchema = {
  confidence: normalizedNumber
    .optional()
    .describe("Minimum template match confidence from 0 to 1."),
  backend: z
    .enum(["ncc", "feature"])
    .optional()
    .describe("Template matching backend. Defaults to ncc; feature is slower but more scale/rotation tolerant."),
  scale: z
    .union([
      z.boolean(),
      z.object({
        min: positiveNumber.optional().describe("Minimum template scale factor."),
        max: positiveNumber.optional().describe("Maximum template scale factor."),
        step: positiveNumber.optional().describe("Template scale search step."),
      }),
    ])
    .optional()
    .describe("Enable multi-scale template matching, or provide an explicit scale range."),
};

const templateImageSchema = z
  .union([
    z.object({
      path: z.string().describe("Template image file path."),
    }),
    z.object({
      base64: z.string().describe("Base64-encoded template image bytes."),
      mimeType: z
        .enum(["image/png", "image/jpeg", "image/webp"])
        .optional()
        .describe("MIME type for documentation and client routing."),
    }),
  ])
  .describe("Template image as a file path or base64-encoded PNG/JPEG/WebP bytes.");

const captureSourceFields = {
  source: sourceSchema,
  windowId: z
    .string()
    .optional()
    .describe('Window ID required when source is "window".'),
  region: regionSchema,
  detail: captureDetailSchema,
};

const ocrFields = {
  text: z
    .string()
    .optional()
    .describe("Optional query text. When omitted, the tool returns OCR lines."),
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
  ...ocrModelOptionsSchema,
  debugImage: debugImageSchema,
};

const templateFields = {
  image: templateImageSchema,
  ...matchOptionsSchema,
  debugImage: debugImageSchema,
};

const templateListFields = {
  ...templateFields,
  all: z
    .boolean()
    .optional()
    .describe("Return all template matches instead of only the best match."),
};

const tapFields = {
  ...templateFields,
  button: z
    .enum(["left", "right", "middle"])
    .optional()
    .describe("Mouse button to tap after a successful match. Defaults to left."),
};

const colorObjectSchema = z.object({
  r: z.number().int().min(0).max(255).describe("Red channel, 0-255."),
  g: z.number().int().min(0).max(255).describe("Green channel, 0-255."),
  b: z.number().int().min(0).max(255).describe("Blue channel, 0-255."),
});

const colorSchema = z
  .union([
    z.string().regex(/^#?[0-9a-fA-F]{6}$/).describe("RGB hex color such as #ff8800."),
    colorObjectSchema,
  ])
  .describe("Target RGB color as #rrggbb or {r,g,b}.");

const colorFields = {
  color: colorSchema,
  tolerance: z
    .number()
    .int()
    .min(0)
    .max(255)
    .optional()
    .describe("Per-channel RGB tolerance, 0-255. Defaults to 0."),
};

const waitFields = {
  timeoutMs: positiveNumber.describe("Timeout in milliseconds."),
  intervalMs: positiveNumber
    .optional()
    .describe("Polling interval in milliseconds. Native defaults are used when omitted."),
};

type CaptureSource = "screen" | "active" | "window";
type CaptureArgs = {
  source?: CaptureSource;
  windowId?: string;
  region?: Region;
  detail?: CaptureArtifactDetail;
};

type CaptureContext = {
  source: CaptureSource;
  windowId?: string;
  capture: CaptureImage;
  artifact: CaptureArtifact;
  origin: Point;
};

type TemplateImageInput = z.infer<typeof templateImageSchema>;

export function registerVisualTools(server: McpServer): void {
  registerSafeTool(
    server,
    "desktop_get_pixel_color",
    {
      description:
        "Read the RGB color of one desktop screen pixel. Returns the color and the queried screen coordinates.",
      inputSchema: z
        .object({
          x: finiteNumber.describe("Screen x coordinate."),
          y: finiteNumber.describe("Screen y coordinate."),
        })
        .shape,
    },
    async (args) => {
      const x = Math.round(args.x);
      const y = Math.round(args.y);
      return json({ color: screen.color.get(x, y), x, y });
    }
  );

  registerSafeTool(
    server,
    "desktop_find_color",
    {
      description:
        "Find pixels matching an RGB color on the desktop. Returns either the best match or all matches in screen coordinates.",
      inputSchema: z
        .object({
          ...colorFields,
          region: regionSchema,
          all: z
            .boolean()
            .optional()
            .describe("Return all matching pixels instead of the first match."),
        })
        .shape,
    },
    async (args) => {
      const color = parseColor(args.color);
      const options = { tolerance: args.tolerance, region: args.region };
      if (args.all) {
        const matches = screen.color.findAll(color, options);
        return json({ matches, count: matches.length });
      }
      const match = screen.color.find(color, options);
      return json({ match, matched: match !== null });
    }
  );

  registerSafeTool(
    server,
    "desktop_wait_for_color",
    {
      description:
        "Poll one desktop screen pixel until it matches an RGB color. Returns matched=true or an error on timeout.",
      inputSchema: z
        .object({
          x: finiteNumber.describe("Screen x coordinate."),
          y: finiteNumber.describe("Screen y coordinate."),
          ...colorFields,
          ...waitFields,
        })
        .shape,
    },
    async (args) => {
      return json({
        matched: screen.color.wait(Math.round(args.x), Math.round(args.y), parseColor(args.color), {
          tolerance: args.tolerance,
          timeoutMs: args.timeoutMs,
          intervalMs: args.intervalMs,
        }),
      });
    }
  );

  registerSafeTool(
    server,
    "desktop_wait_for_stable",
    {
      description:
        "Wait until a desktop screen region has remained visually stable. Returns stable=true and durationMs, or an error on timeout.",
      inputSchema: z
        .object({
          ...captureSourceFields,
          threshold: normalizedNumber
            .optional()
            .describe("Maximum changed pixel fraction considered stable. Defaults to 0."),
          settleMs: positiveNumber
            .optional()
            .describe("Required continuous stable duration in milliseconds. Defaults to 250."),
          timeoutMs: positiveNumber
            .optional()
            .describe("Timeout in milliseconds. Defaults to 5000."),
          intervalMs: positiveNumber
            .optional()
            .describe("Polling interval in milliseconds. Defaults to 100."),
        })
        .shape,
    },
    async (args) => {
      const started = Date.now();
      const stable = screen.waitForStable({
        region: stableRegion(args),
        threshold: args.threshold,
        settleMs: args.settleMs,
        timeoutMs: args.timeoutMs,
        intervalMs: args.intervalMs,
      });
      return json({ stable, durationMs: Date.now() - started });
    }
  );

  registerSafeTool(
    server,
    "desktop_highlight_region",
    {
      description:
        "Capture the desktop and write a PNG artifact with a software outline around a screen-space region. Returns debugImagePath.",
      inputSchema: z
        .object({
          region: regionSchema.unwrap().describe("Screen-space region to highlight."),
          color: colorSchema.optional().describe("Outline color. Defaults to green."),
        })
        .shape,
    },
    async (args) => {
      const capture = screen.capture();
      const artifact = writeDebugCapture(
        capture,
        [
          {
            kind: "region",
            region: args.region,
            color: rgba(parseColor(args.color ?? "#00cc66")),
          },
        ],
        { prefix: "desktop-highlight-region" }
      );
      return json({ debugImagePath: artifact.imagePath, ...artifact });
    }
  );

  registerSafeTool(
    server,
    "desktop_capture_and_ocr",
    {
      description:
        "Capture a desktop source once, write a PNG artifact, and run OCR on the same original in-memory capture. Returns screen-space OCR lines or matches.",
      inputSchema: z
        .object({
          ...captureSourceFields,
          ...ocrFields,
        })
        .shape,
    },
    async (args) => {
      const capture = captureDesktopSource(args, "desktop-capture-ocr");
      const ocr = await getOcr(args);
      const lines = await ocr.read(capture.capture, {
        searchRegion: undefined,
        origin: capture.origin,
      });

      if (args.text !== undefined) {
        const candidates = scoreOcrLines(lines, args.text, {
          exact: args.exact,
          caseSensitive: args.caseSensitive,
          minSimilarity: args.minSimilarity,
        });
        const matches = matchingOcrLines(candidates);
        return json({
          ...captureResponse(capture),
          matches,
          ...(args.debugImage ? { candidates } : {}),
          ...debugImagePatch(args.debugImage, () =>
            writeDebugCapture(
              capture.capture,
              offsetAnnotations(ocrLineAnnotations(candidates), capture.origin),
              { prefix: "desktop-capture-ocr-debug" }
            )
          ),
        });
      }

      return json({
        ...captureResponse(capture),
        lines,
        ...debugImagePatch(args.debugImage, () =>
          writeDebugCapture(
            capture.capture,
            offsetAnnotations(ocrLineAnnotations(lines), capture.origin),
            { prefix: "desktop-capture-ocr-debug" }
          )
        ),
      });
    }
  );

  registerSafeTool(
    server,
    "desktop_capture_and_find_template",
    {
      description:
        "Capture a desktop source once, write a PNG artifact, and run template matching on the same original in-memory capture. Returns screen-space matches.",
      inputSchema: z
        .object({
          ...captureSourceFields,
          ...templateListFields,
        })
        .shape,
    },
    async (args) => {
      const capture = captureDesktopSource(args, "desktop-capture-template");
      const needle = decodeTemplateImage(args.image);
      const localMatches = args.all
        ? await coreImage.findAllTemplates(capture.capture, needle, localMatchOptions(args))
        : [await coreImage.findTemplate(capture.capture, needle, localMatchOptions(args))];
      const matches = localMatches.map((match) => translateMatch(match, capture.origin));

      return json({
        ...captureResponse(capture),
        matches,
        ...debugImagePatch(args.debugImage, () =>
          writeDebugCapture(capture.capture, matchAnnotations(localMatches), {
            prefix: "desktop-capture-template-debug",
          })
        ),
      });
    }
  );

  registerSafeTool(
    server,
    "desktop_find_template_and_tap",
    {
      description:
        "Capture a desktop source once, find the best template match, and tap its screen-space center. The mouse is tapped only after a successful match.",
      inputSchema: z
        .object({
          ...captureSourceFields,
          ...tapFields,
        })
        .shape,
    },
    async (args) => {
      const capture = captureDesktopSource(args, "desktop-template-tap");
      const needle = decodeTemplateImage(args.image);
      const localMatch = await coreImage.findTemplate(
        capture.capture,
        needle,
        localMatchOptions(args)
      );
      const match = translateMatch(localMatch, capture.origin);
      const tapPoint = match.center;
      mouse.tap(tapPoint.x, tapPoint.y, args.button);

      return json({
        ...captureResponse(capture),
        match,
        tapPoint,
        button: args.button ?? "left",
        ...debugImagePatch(args.debugImage, () =>
          writeDebugCapture(capture.capture, matchAnnotations([localMatch]), {
            prefix: "desktop-template-tap-debug",
          })
        ),
      });
    }
  );
}

function captureDesktopSource(args: CaptureArgs, prefix: string): CaptureContext {
  const source = args.source ?? "screen";
  if (source === "window" && !args.windowId) {
    throw new Error('source "window" requires windowId');
  }

  if (source === "screen") {
    const capture = screen.capture(args.region);
    return buildCaptureContext({
      source,
      capture,
      prefix,
      detail: args.detail,
      origin: {
        x: args.region?.left ?? 0,
        y: args.region?.top ?? 0,
      },
    });
  }

  if (source === "active") {
    const active = windows.getActive();
    const capture = screen.captureWindow(active.id);
    return buildCaptureContext({
      source,
      windowId: active.id,
      capture,
      prefix,
      detail: args.detail,
      origin: {
        x: active.region.left,
        y: active.region.top,
      },
    });
  }

  const windowId = args.windowId!;
  const region = windows.getRegion(windowId);
  const capture = screen.captureWindow(windowId);
  return buildCaptureContext({
    source,
    windowId,
    capture,
    prefix,
    detail: args.detail,
    origin: {
      x: region.left,
      y: region.top,
    },
  });
}

function buildCaptureContext(args: {
  source: CaptureSource;
  windowId?: string;
  capture: CaptureImage;
  prefix: string;
  detail?: CaptureArtifactDetail;
  origin: Point;
}): CaptureContext {
  return {
    source: args.source,
    windowId: args.windowId,
    capture: args.capture,
    artifact: workspaceImageStore.writeCapture(args.capture, {
      prefix: args.prefix,
      detail: args.detail ?? "original",
    }),
    origin: args.origin,
  };
}

function captureResponse(capture: CaptureContext) {
  return {
    ...capture.artifact,
    source: capture.source,
    ...(capture.windowId ? { windowId: capture.windowId } : {}),
    origin: capture.origin,
    coordinateSpace: "screen",
  };
}

function decodeTemplateImage(image: TemplateImageInput): string | Buffer {
  if ("path" in image) return image.path;
  return Buffer.from(image.base64, "base64");
}

function localMatchOptions(args: {
  confidence?: number;
  backend?: "ncc" | "feature";
  scale?: boolean | { min?: number; max?: number; step?: number };
}) {
  return {
    confidence: args.confidence,
    region: undefined,
    scale: args.scale,
    ...(args.backend ? { backend: args.backend } : {}),
  };
}

function translateMatch(match: MatchResult, origin: Point): MatchResult {
  return {
    ...match,
    region: {
      left: match.region.left + origin.x,
      top: match.region.top + origin.y,
      width: match.region.width,
      height: match.region.height,
    },
    center: {
      x: match.center.x + origin.x,
      y: match.center.y + origin.y,
    },
  };
}

function parseColor(color: z.infer<typeof colorSchema>): Rgb {
  if (typeof color !== "string") return color;
  const hex = color.startsWith("#") ? color.slice(1) : color;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgba(color: Rgb): [number, number, number, number] {
  return [color.r, color.g, color.b, 255];
}

function stableRegion(args: CaptureArgs): Region | undefined {
  const source = args.source ?? "screen";
  if (source === "screen") return args.region;
  if (source === "active") return windows.getActive().region;
  if (!args.windowId) {
    throw new Error('source "window" requires windowId');
  }
  return windows.getRegion(args.windowId);
}
