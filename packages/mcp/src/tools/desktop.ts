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

const regionSchema = z
  .object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .optional();

const matchOptionsSchema = {
  confidence: z.number().optional(),
  region: regionSchema,
  scale: z
    .union([
      z.boolean(),
      z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().optional(),
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

function decodeTemplateImage(image: z.infer<typeof templateImageSchema>): string | Buffer {
  if ("path" in image) return image.path;
  return Buffer.from(image.base64, "base64");
}

export function registerDesktopTools(server: McpServer, a11yEnabled: boolean): void {
  server.registerTool(
    "desktop_list_windows",
    {
      description: "List visible top-level windows with process metadata",
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(windows.list(), null, 2) }],
    })
  );

  server.registerTool(
    "desktop_list_apps",
    {
      description: "List desktop applications aggregated by process ID",
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(desktop.listApps(), null, 2) }],
    })
  );

  server.registerTool(
    "desktop_get_active_window",
    { description: "Get the foreground window" },
    async () => ({
      content: [
        { type: "text", text: JSON.stringify(windows.active(), null, 2) },
      ],
    })
  );

  server.registerTool(
    "desktop_capture_screen",
    {
      description:
        "Capture screen or region, downscale long edge to 1600 when needed, and return a workspace PNG file path",
      inputSchema: z.object({ region: regionSchema }),
    },
    async ({ region }) => {
      const cap = captureScreenArtifact(region);
      return {
        content: [{ type: "text", text: JSON.stringify(cap, null, 2) }],
      };
    }
  );

  server.registerTool(
    "desktop_capture_window",
    {
      description:
        "Capture a window by id, downscale long edge to 1600 when needed, and return a workspace PNG file path",
      inputSchema: z.object({ windowId: z.string() }),
    },
    async ({ windowId }) => {
      const cap = captureWindowArtifact(windowId);
      return {
        content: [{ type: "text", text: JSON.stringify(cap, null, 2) }],
      };
    }
  );

  server.registerTool(
    "desktop_capture_active",
    {
      description:
        "Capture the foreground window, downscale long edge to 1600 when needed, and return a workspace PNG file path",
    },
    async () => {
      const cap = captureActiveArtifact();
      return {
        content: [{ type: "text", text: JSON.stringify(cap, null, 2) }],
      };
    }
  );

  server.registerTool(
    "desktop_focus_window",
    {
      inputSchema: z.object({ windowId: z.string() }),
    },
    async ({ windowId }) => {
      windows.focus(windowId);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_mouse_move",
    { inputSchema: z.object({ x: z.number(), y: z.number() }) },
    async ({ x, y }) => {
      mouse.move(x, y);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_mouse_click",
    {
      inputSchema: z.object({
        button: z.enum(["left", "right", "middle"]).optional(),
      }),
    },
    async ({ button }) => {
      mouse.click(button);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_mouse_tap",
    {
      inputSchema: z.object({
        x: z.number(),
        y: z.number(),
        button: z.enum(["left", "right", "middle"]).optional(),
      }),
    },
    async ({ x, y, button }) => {
      mouse.tap(x, y, button);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_keyboard_type",
    { inputSchema: z.object({ text: z.string() }) },
    async ({ text }) => {
      keyboard.write(text);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_clipboard_get",
    {},
    async () => ({
      content: [{ type: "text", text: clipboard.get() }],
    })
  );

  server.registerTool(
    "desktop_clipboard_set",
    { inputSchema: z.object({ text: z.string() }) },
    async ({ text }) => {
      clipboard.set(text);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { matches, coordinateSpace: "screen" },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  if (!a11yEnabled) return;

  server.registerTool(
    "desktop_a11y_attach_window",
    {
      inputSchema: z.object({
        windowId: z.string(),
        maxDepth: z.number().optional(),
      }),
    },
    async ({ windowId, maxDepth }) => {
      const report = accessibility.debug.attachWindowReport(windowId, maxDepth ?? 12);
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }
  );

  server.registerTool(
    "desktop_a11y_find",
    {
      inputSchema: z.object({
        rootId: z.string(),
        name: z.string().optional(),
        nameContains: z.string().optional(),
        controlType: z.string().optional(),
        automationId: z.string().optional(),
        maxDepth: z.number().optional(),
      }),
    },
    async (args) => {
      const { rootId, maxDepth, ...query } = args;
      const id = accessibility.quick.find(rootId, query, maxDepth ?? 12);
      return { content: [{ type: "text", text: id }] };
    }
  );

  server.registerTool(
    "desktop_a11y_invoke",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      accessibility.quick.invoke(elementId);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_a11y_tap_element",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      const region = accessibility.quick.click(elementId);
      return { content: [{ type: "text", text: JSON.stringify(region, null, 2) }] };
    }
  );

  server.registerTool(
    "desktop_a11y_dump_tree",
    {
      inputSchema: z.object({
        rootId: z.string(),
        maxDepth: z.number().optional(),
        treeView: z.enum(["auto", "raw", "control", "content"]).optional(),
      }),
    },
    async ({ rootId, maxDepth, treeView }) => {
      const tree = accessibility.debug.dumpTree(rootId, {
        maxDepth: maxDepth ?? 12,
        treeView,
      });
      return { content: [{ type: "text", text: tree }] };
    }
  );

  server.registerTool(
    "desktop_a11y_element_info",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      const info = accessibility.debug.getElementInfo(elementId);
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
  );
}
