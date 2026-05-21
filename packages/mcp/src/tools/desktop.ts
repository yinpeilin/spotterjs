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
  windowApi,
} from "@spotter/core";
import {
  captureActiveBase64,
  captureScreenBase64,
  captureWindowBase64,
} from "../adapters/capture.js";

const regionSchema = z
  .object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .optional();

export function registerDesktopTools(server: McpServer, a11yEnabled: boolean): void {
  server.registerTool(
    "desktop_list_windows",
    {
      description: "List visible top-level windows with process metadata",
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(windowApi.list(), null, 2) }],
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
        { type: "text", text: JSON.stringify(windowApi.getActive(), null, 2) },
      ],
    })
  );

  server.registerTool(
    "desktop_capture_screen",
    {
      description: "Capture screen or region; returns PNG base64",
      inputSchema: z.object({ region: regionSchema }),
    },
    async ({ region }) => {
      const cap = captureScreenBase64(region);
      return {
        content: [
          { type: "text", text: JSON.stringify({ ...cap, base64: `[${cap.base64.length} chars]` }) },
          {
            type: "image",
            data: cap.base64,
            mimeType: "image/png",
          },
        ],
      };
    }
  );

  server.registerTool(
    "desktop_capture_window",
    {
      description: "Capture a window by id; returns PNG base64",
      inputSchema: z.object({ windowId: z.string() }),
    },
    async ({ windowId }) => {
      const cap = captureWindowBase64(windowId);
      return {
        content: [
          { type: "text", text: JSON.stringify({ width: cap.width, height: cap.height, windowId }) },
          { type: "image", data: cap.base64, mimeType: "image/png" },
        ],
      };
    }
  );

  server.registerTool(
    "desktop_capture_active",
    {
      description: "Capture the foreground window; returns PNG base64",
    },
    async () => {
      const cap = captureActiveBase64();
      return {
        content: [
          { type: "text", text: JSON.stringify({ width: cap.width, height: cap.height }) },
          { type: "image", data: cap.base64, mimeType: "image/png" },
        ],
      };
    }
  );

  server.registerTool(
    "desktop_focus_window",
    {
      inputSchema: z.object({ windowId: z.string() }),
    },
    async ({ windowId }) => {
      windowApi.focus(windowId);
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
      keyboard.type(text);
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
        path: z.string(),
        confidence: z.number().optional(),
      }),
    },
    async ({ path, confidence }) => {
      const region = await screen.find(path, { confidence });
      return { content: [{ type: "text", text: JSON.stringify(region, null, 2) }] };
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
      const report = accessibility.attachWindowReport(windowId, maxDepth ?? 12);
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
      const id = accessibility.find(rootId, query, maxDepth ?? 12);
      return { content: [{ type: "text", text: id }] };
    }
  );

  server.registerTool(
    "desktop_a11y_invoke",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      accessibility.invoke(elementId);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "desktop_a11y_tap_element",
    { inputSchema: z.object({ elementId: z.string() }) },
    async ({ elementId }) => {
      const region = accessibility.tapElement(elementId);
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
      const tree = accessibility.dumpTree(rootId, {
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
      const info = accessibility.getElementInfo(elementId);
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
  );
}
