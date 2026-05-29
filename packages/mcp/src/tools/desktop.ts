import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  accessibility,
  clipboard,
  desktop,
  keyboard,
  mouse,
  screen,
  windows,
} from "@spotterjs/core";
import {
  captureActiveArtifact,
  captureScreenArtifact,
  captureWindowArtifact,
} from "../adapters/capture.js";
import { json, ok, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();
const nonNegativeNumber = finiteNumber.min(0);
const captureDetailSchema = z.enum(["high", "original"]).optional();

const regionSchema = z
  .object({
    left: finiteNumber,
    top: finiteNumber,
    width: positiveNumber,
    height: positiveNumber,
  })
  .optional();

const matchOptionsSchema = {
  confidence: nonNegativeNumber.max(1).optional(),
  region: regionSchema,
  scale: z
    .union([
      z.boolean(),
      z.object({
        min: positiveNumber.optional(),
        max: positiveNumber.optional(),
        step: positiveNumber.optional(),
      }),
    ])
    .optional(),
};

const templateImageSchema = z.union([
  z.object({ path: z.string() }),
  z.object({
    base64: z.string(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  }),
]);

const captureDetailOptionsSchema = {
  detail: captureDetailSchema,
};

const keyboardOptionsSchema = {
  autoDelayMs: finiteNumber.min(0).optional(),
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
        windowId: z.string(),
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
      inputSchema: z.object({ windowId: z.string() }),
    },
    async ({ windowId }) => {
      windows.focus(windowId);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_mouse_move",
    { inputSchema: z.object({ x: finiteNumber, y: finiteNumber }) },
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
        button: z.enum(["left", "right", "middle"]).optional(),
      }),
    },
    async ({ button }) => {
      mouse.click(button);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_mouse_tap",
    {
      inputSchema: z.object({
        x: finiteNumber,
        y: finiteNumber,
        button: z.enum(["left", "right", "middle"]).optional(),
      }),
    },
    async ({ x, y, button }) => {
      mouse.tap(x, y, button);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "desktop_keyboard_type",
    {
      inputSchema: z.object({
        text: z.string(),
        ...keyboardOptionsSchema,
        mode: z.enum(["paste", "native"]).optional(),
        restoreClipboard: z.boolean().optional(),
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
        key: keyboardTapKeySchema,
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
    { inputSchema: z.object({ text: z.string() }) },
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
        all: z.boolean().optional(),
      }),
    },
    async ({ image, all, ...options }) => {
      const needle = decodeTemplateImage(image);
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
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      const region = accessibility.quick.click(elementId);
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
