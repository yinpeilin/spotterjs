import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  accessibility,
  clipboard,
  desktop,
  image as coreImage,
  keyboard,
  mouse,
  screen,
  windows,
} from "@spotterjs/core";
import { centerOf, type MatchResult, type Point, type Region } from "@spotterjs/base";
import {
  captureActiveArtifact,
  captureScreenArtifact,
  captureWindowArtifact,
} from "../adapters/capture.js";
import {
  type DebugAnnotation,
  writeDebugCapture,
} from "../adapters/debug-draw.js";
import { json, ok, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const nonNegativeNumber = finiteNumber.min(0);
const captureDetailSchema = z
  .enum(["high", "original"])
  .optional()
  .describe(
    'Artifact detail. "high" downscales large captures; "original" preserves pixels.'
  );

const regionSchema = z
  .object({
    left: finiteNumber.describe("Screen x coordinate of the region left edge."),
    top: finiteNumber.describe("Screen y coordinate of the region top edge."),
    width: positiveNumber.describe("Region width in pixels."),
    height: positiveNumber.describe("Region height in pixels."),
  })
  .optional()
  .describe("Optional screen search or capture region.");

const matchOptionsSchema = {
  confidence: nonNegativeNumber
    .max(1)
    .optional()
    .describe("Minimum template match confidence from 0 to 1."),
  region: regionSchema,
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

const templateImageSchema = z.union([
  z.object({ path: z.string().describe("Template image file path.") }),
  z.object({
    base64: z.string().describe("Base64-encoded template image bytes."),
    mimeType: z
      .enum(["image/png", "image/jpeg", "image/webp"])
      .optional()
      .describe("Template image MIME type."),
  }),
]).describe("Template image as a file path or base64-encoded PNG/JPEG/WebP bytes.");

const captureDetailOptionsSchema = {
  detail: captureDetailSchema,
};

const debugImageOptionsSchema = {
  debugImage: z
    .boolean()
    .optional()
    .describe("When true, write an annotated debug PNG under .spotter/artifacts."),
};

const keyboardOptionsSchema = {
  autoDelayMs: finiteNumber
    .min(0)
    .optional()
    .describe("Delay in milliseconds between key events."),
};

const keyboardTapKeySchema = z.union([
  z.string(),
  z.number().int().min(0).max(9),
]);

function decodeTemplateImage(image: z.infer<typeof templateImageSchema>): string | Buffer {
  if ("path" in image) return image.path;
  return Buffer.from(image.base64, "base64");
}

export function registerDesktopTools(server: McpServer, a11yEnabled: boolean): void {
  registerSafeTool(
    server,
    "desktop_list_windows",
    {
      description: "List visible top-level windows with process metadata",
    },
    async () => json(windows.list())
  );

  registerSafeTool(
    server,
    "desktop_list_apps",
    {
      description: "List desktop applications aggregated by process ID",
    },
    async () => json(desktop.listApps())
  );

  registerSafeTool(
    server,
    "desktop_get_active_window",
    { description: "Get the foreground window" },
    async () => json(windows.active())
  );

  registerSafeTool(
    server,
    "desktop_capture_screen",
    {
      description:
        "Capture screen or region, downscale long edge to 1600 by default, and return a workspace PNG file path",
      inputSchema: {
        region: regionSchema,
        ...captureDetailOptionsSchema,
      },
    },
    async ({ region, detail }) => {
      const cap = captureScreenArtifact(region, { detail });
      return json(cap);
    }
  );

  registerSafeTool(
    server,
    "desktop_capture_window",
    {
      description:
        "Capture a window by id, downscale long edge to 1600 by default, and return a workspace PNG file path",
      inputSchema: {
        windowId: z.string().describe("Window ID returned by desktop_list_windows."),
        ...captureDetailOptionsSchema,
      },
    },
    async ({ windowId, detail }) => {
      const cap = captureWindowArtifact(windowId, { detail });
      return json(cap);
    }
  );

  registerSafeTool(
    server,
    "desktop_capture_active",
    {
      description:
        "Capture the foreground window, downscale long edge to 1600 by default, and return a workspace PNG file path",
      inputSchema: captureDetailOptionsSchema,
    },
    async ({ detail }) => {
      const cap = captureActiveArtifact({ detail });
      return json(cap);
    }
  );

  registerSafeTool(
    server,
    "desktop_focus_window",
    {
      description: "Bring a window returned by desktop_list_windows to the foreground",
      inputSchema: z.object({
        windowId: z.string().describe("Window ID returned by desktop_list_windows."),
      }),
    },
    async ({ windowId }) => {
      windows.focus(windowId);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_mouse_move",
    {
      description: "Move the mouse cursor to a screen coordinate",
      inputSchema: z.object({
        x: finiteNumber.describe("Screen x coordinate."),
        y: finiteNumber.describe("Screen y coordinate."),
      }),
    },
    async ({ x, y }) => {
      mouse.move(x, y);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_mouse_click",
    {
      inputSchema: z.object({
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .describe("Mouse button. Defaults to left."),
        ...debugImageOptionsSchema,
      }),
    },
    async ({ button, debugImage }) => {
      const tapPoint = debugImage ? mouse.getPosition() : undefined;
      const capture = debugImage ? screen.capture() : undefined;
      mouse.click(button);
      if (debugImage && tapPoint && capture) {
        const debug = writeDebugCapture(
          capture,
          [{ kind: "point", point: tapPoint }],
          { prefix: "desktop-mouse-click-debug" }
        );
        return json({
          status: "ok",
          tapPoint,
          button: button ?? "left",
          coordinateSpace: "screen",
          debugImagePath: debug.imagePath,
        });
      }
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_mouse_tap",
    {
      inputSchema: z.object({
        x: finiteNumber.describe("Screen x coordinate to tap."),
        y: finiteNumber.describe("Screen y coordinate to tap."),
        button: z
          .enum(["left", "right", "middle"])
          .optional()
          .describe("Mouse button. Defaults to left."),
        ...debugImageOptionsSchema,
      }),
    },
    async ({ x, y, button, debugImage }) => {
      const tapPoint = { x, y };
      const capture = debugImage ? screen.capture() : undefined;
      mouse.tap(x, y, button);
      if (debugImage && capture) {
        const debug = writeDebugCapture(
          capture,
          [{ kind: "point", point: tapPoint }],
          { prefix: "desktop-mouse-tap-debug" }
        );
        return json({
          status: "ok",
          tapPoint,
          button: button ?? "left",
          coordinateSpace: "screen",
          debugImagePath: debug.imagePath,
        });
      }
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_keyboard_type",
    {
      inputSchema: z.object({
        text: z.string().describe("Text to type."),
        ...keyboardOptionsSchema,
        mode: z
          .enum(["paste", "native"])
          .optional()
          .describe("Typing mode. Paste is faster; native emits key events."),
        restoreClipboard: z
          .boolean()
          .optional()
          .describe("Restore clipboard content after paste-mode typing."),
      }),
    },
    async ({ text, autoDelayMs, mode, restoreClipboard }) => {
      keyboard.write(text, { autoDelayMs, mode, restoreClipboard });
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_keyboard_tap",
    {
      inputSchema: z.object({
        key: keyboardTapKeySchema.describe("Key name or numeric key to tap."),
        ...keyboardOptionsSchema,
      }),
    },
    async ({ key, autoDelayMs }) => {
      keyboard.tap(key, { autoDelayMs });
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_clipboard_get",
    {},
    async () => ok(clipboard.get())
  );

  registerSafeTool(
    server,
    "desktop_clipboard_set",
    {
      description: "Set clipboard text",
      inputSchema: z.object({ text: z.string().describe("Text to put on the clipboard.") }),
    },
    async ({ text }) => {
      clipboard.set(text);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_find_template",
    {
      inputSchema: z.object({
        image: templateImageSchema,
        ...matchOptionsSchema,
        all: z
          .boolean()
          .optional()
          .describe("Return all template matches instead of only the best match."),
        ...debugImageOptionsSchema,
      }).shape,
    },
    async ({ image, all, debugImage, ...options }) => {
      const needle = decodeTemplateImage(image);
      if (debugImage) {
        const capture = screen.capture(options.region);
        const origin = regionOrigin(options.region);
        const localOptions = {
          confidence: options.confidence,
          region: undefined,
          scale: options.scale,
        };
        const localMatches = all
          ? await coreImage.findAll(capture, needle, localOptions)
          : [await coreImage.find(capture, needle, localOptions)];
        const matches = localMatches.map((match) => translateMatch(match, origin));
        const debug = writeDebugCapture(
          capture,
          matchAnnotations(localMatches),
          { prefix: "desktop-find-template-debug" }
        );
        return json({
          matches,
          coordinateSpace: "screen",
          debugImagePath: debug.imagePath,
        });
      }

      const matches = all
        ? await screen.findAll(needle, options)
        : [await screen.find(needle, options)];
      return json({ matches, coordinateSpace: "screen" });
    }
  );

  if (!a11yEnabled) return;

  registerSafeTool(
    server,
    "desktop_a11y_attach_window",
    {
      inputSchema: z.object({
        windowId: z.string(),
        maxDepth: finiteNumber.min(0).max(100).optional(),
      }),
    },
    async ({ windowId, maxDepth }) => {
      const report = accessibility.debug.attachWindowReport(windowId, maxDepth ?? 12);
      return json(report);
    }
  );

  registerSafeTool(
    server,
    "desktop_a11y_find",
    {
      inputSchema: z.object({
        rootId: z.string(),
        name: z.string().optional(),
        nameContains: z.string().optional(),
        controlType: z.string().optional(),
        automationId: z.string().optional(),
        maxDepth: finiteNumber.min(0).max(100).optional(),
      }),
    },
    async (args) => {
      const { rootId, maxDepth, ...query } = args;
      const id = accessibility.quick.find(rootId, query, maxDepth ?? 12);
      return ok(id);
    }
  );

  registerSafeTool(
    server,
    "desktop_a11y_invoke",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      accessibility.quick.invoke(elementId);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_a11y_tap_element",
    { inputSchema: z.object({ elementId: z.string(), ...debugImageOptionsSchema }) },
    async ({ elementId, debugImage }) => {
      const capture = debugImage ? screen.capture() : undefined;
      const region = accessibility.quick.click(elementId);
      if (debugImage && capture) {
        const tapPoint = centerOf(region);
        const debug = writeDebugCapture(
          capture,
          [
            { kind: "region", region },
            { kind: "point", point: tapPoint },
          ],
          { prefix: "desktop-a11y-tap-debug" }
        );
        return json({
          region,
          tapPoint,
          coordinateSpace: "screen",
          debugImagePath: debug.imagePath,
        });
      }
      return json(region);
    }
  );

  registerSafeTool(
    server,
    "desktop_a11y_dump_tree",
    {
      inputSchema: z.object({
        rootId: z.string(),
        maxDepth: finiteNumber.min(0).max(100).optional(),
        treeView: z.enum(["auto", "raw", "control", "content"]).optional(),
      }),
    },
    async ({ rootId, maxDepth, treeView }) => {
      const tree = accessibility.debug.dumpTree(rootId, {
        maxDepth: maxDepth ?? 12,
        treeView,
      });
      return ok(tree);
    }
  );

  registerSafeTool(
    server,
    "desktop_a11y_element_info",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      const info = accessibility.debug.getElementInfo(elementId);
      return json(info);
    }
  );
}

function regionOrigin(region?: Region): Point {
  return {
    x: region?.left ?? 0,
    y: region?.top ?? 0,
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

function matchAnnotations(matches: MatchResult[]): DebugAnnotation[] {
  const annotations: DebugAnnotation[] = [];
  for (const match of matches) {
    annotations.push({ kind: "region", region: match.region });
    annotations.push({ kind: "point", point: match.center });
  }
  return annotations;
}
