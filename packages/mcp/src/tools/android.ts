import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { android } from "@spotterjs/plugin-android";
import type {
  AndroidCompanionDevice,
  AndroidElementNode,
  AndroidGestureStroke,
} from "@spotterjs/plugin-android";
import type { CaptureArtifactDetail } from "../adapters/artifacts.js";
import { json, ok, registerSafeTool } from "./results.js";

const DEFAULT_DEVICE_ID = "default";
const finiteNumberSchema = z.number().finite();
const coordinateSchema = finiteNumberSchema.min(0);
const timeoutMsSchema = finiteNumberSchema.min(0);
const positiveDurationMsSchema = finiteNumberSchema.min(0);
const confidenceSchema = finiteNumberSchema.min(0).max(1);
const maxDepthSchema = z.number().int().min(0).max(100);
const captureDetailSchema = z.enum(["high", "original"]).optional();
const deviceIdSchema = z.string().min(1).optional();

const companionOptionsSchema = {
  deviceId: deviceIdSchema,
  url: z.string(),
  sessionToken: z.string().optional(),
  code: z.string().optional(),
  clientId: z.string().optional(),
  timeoutMs: timeoutMsSchema.optional(),
};

const sessionSchema = {
  deviceId: deviceIdSchema,
  url: z.string().optional(),
  sessionToken: z.string().optional(),
  timeoutMs: timeoutMsSchema.optional(),
};

const pointSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
});

const regionSchema = z
  .object({
    left: coordinateSchema,
    top: coordinateSchema,
    width: finiteNumberSchema.positive(),
    height: finiteNumberSchema.positive(),
  })
  .optional();

const matchOptionsSchema = {
  confidence: confidenceSchema.optional(),
  region: regionSchema,
  scale: z
    .union([
      z.boolean(),
      z.object({
        min: finiteNumberSchema.positive().optional(),
        max: finiteNumberSchema.positive().optional(),
        step: finiteNumberSchema.positive().optional(),
      }),
    ])
    .optional(),
};

const elementQuerySchema = {
  text: z.string().optional(),
  textContains: z.string().optional(),
  resourceId: z.string().optional(),
  resourceIdContains: z.string().optional(),
  className: z.string().optional(),
  classNameContains: z.string().optional(),
  contentDescription: z.string().optional(),
  contentDescriptionContains: z.string().optional(),
  packageName: z.string().optional(),
  clickable: z.boolean().optional(),
  enabled: z.boolean().optional(),
  checked: z.boolean().optional(),
  selected: z.boolean().optional(),
  scrollable: z.boolean().optional(),
  focusable: z.boolean().optional(),
};

const treeOptionsSchema = {
  maxDepth: maxDepthSchema.optional(),
};

const gestureStrokeSchema = z.object({
  points: z.array(pointSchema).min(1),
  durationMs: positiveDurationMsSchema.optional(),
  startDelayMs: positiveDurationMsSchema.optional(),
});

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

function withAndroidCoordinateSpace<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    coordinateSpace: "android-device",
  };
}

function serialJson(deviceId: string, device: { sessionToken: string; url: string }) {
  return json({ deviceId, sessionToken: device.sessionToken, url: device.url });
}

function elementQuery(args: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const key of Object.keys(elementQuerySchema)) {
    if (args[key] !== undefined) query[key] = args[key];
  }
  return query;
}

function findElements(root: AndroidElementNode, query: Record<string, unknown>): AndroidElementNode[] {
  const matches: AndroidElementNode[] = [];
  visit(root, (node) => {
    if (matchesQuery(node, query)) matches.push(node);
  });
  return matches;
}

function visit(node: AndroidElementNode, fn: (node: AndroidElementNode) => void): void {
  fn(node);
  for (const child of node.children ?? []) visit(child, fn);
}

function matchesQuery(node: AndroidElementNode, query: Record<string, unknown>): boolean {
  return (
    matchesExact(node.text, query.text) &&
    matchesContains(node.text, query.textContains) &&
    matchesExact(node.resourceId, query.resourceId) &&
    matchesContains(node.resourceId, query.resourceIdContains) &&
    matchesExact(node.className, query.className) &&
    matchesContains(node.className, query.classNameContains) &&
    matchesExact(node.contentDescription, query.contentDescription) &&
    matchesContains(node.contentDescription, query.contentDescriptionContains) &&
    matchesExact(node.packageName, query.packageName) &&
    matchesBoolean(node.clickable, query.clickable) &&
    matchesBoolean(node.enabled, query.enabled) &&
    matchesBoolean(node.checked, query.checked) &&
    matchesBoolean(node.selected, query.selected) &&
    matchesBoolean(node.scrollable, query.scrollable) &&
    matchesBoolean(node.focusable, query.focusable)
  );
}

function matchesExact(value: string, expected: unknown): boolean {
  return expected === undefined || value === expected;
}

function matchesContains(value: string, expected: unknown): boolean {
  return expected === undefined || (typeof expected === "string" && value.includes(expected));
}

function matchesBoolean(value: boolean, expected: unknown): boolean {
  return expected === undefined || value === expected;
}

async function waitForElement(
  device: AndroidCompanionDevice,
  args: {
    timeoutMs?: number;
    waitTimeoutMs: number;
    pollMs?: number;
    maxDepth?: number;
    [key: string]: unknown;
  }
): Promise<AndroidElementNode> {
  const deadline = Date.now() + args.waitTimeoutMs;
  const pollMs = typeof args.pollMs === "number" ? args.pollMs : 250;
  const query = elementQuery(args);
  let lastCount = 0;
  while (Date.now() <= deadline) {
    const matches = findElements(await device.dumpTree({ maxDepth: args.maxDepth }), query);
    lastCount = matches.length;
    const first = matches[0];
    if (first) return first;
    if (pollMs > 0) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Android element not found before timeout; matches=${lastCount}`);
}

export function registerAndroidTools(server: McpServer): void {
  type SessionArgs = {
    deviceId?: string;
    url?: string;
    sessionToken?: string;
    timeoutMs?: number;
  };
  const devices = new Map<string, AndroidCompanionDevice>();

  function normalizeDeviceId(deviceId?: string): string {
    return deviceId?.trim() || DEFAULT_DEVICE_ID;
  }

  function rememberDevice(deviceId: string, device: AndroidCompanionDevice): void {
    devices.get(deviceId)?.close();
    devices.set(deviceId, device);
  }

  async function resolveDevice(args: SessionArgs): Promise<{
    device: AndroidCompanionDevice;
    cached: boolean;
  }> {
    const deviceId = normalizeDeviceId(args.deviceId);
    const cached = devices.get(deviceId);
    if (cached) return { device: cached, cached: true };

    if (args.url && args.sessionToken) {
      return {
        device: await android.connect({
          url: args.url,
          sessionToken: args.sessionToken,
          timeoutMs: args.timeoutMs,
        }),
        cached: false,
      };
    }

    throw new Error(
      `Android device session not found: ${deviceId}; call android_connect first or pass url/sessionToken`
    );
  }

  async function withDevice<T>(
    args: SessionArgs,
    action: (device: AndroidCompanionDevice) => Promise<T>
  ): Promise<T> {
    const resolved = await resolveDevice(args);
    try {
      return await action(resolved.device);
    } finally {
      if (!resolved.cached) resolved.device.close();
    }
  }

  registerSafeTool(
    server,
    "android_connect",
    {
      description: "Connect to a Spotter mobile companion app over WebSocket",
      inputSchema: z.object(companionOptionsSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url: string;
      sessionToken?: string;
      code?: string;
      clientId?: string;
      timeoutMs?: number;
    }) => {
      const deviceId = normalizeDeviceId(args.deviceId);
      if (args.sessionToken) {
        const device = await android.connect({
          url: args.url,
          sessionToken: args.sessionToken,
          timeoutMs: args.timeoutMs,
        });
        rememberDevice(deviceId, device);
        return serialJson(deviceId, device);
      }
      if (!args.code) {
        return json({ deviceId, url: args.url, needsPairing: true });
      }
      const device = await android.pair({
        url: args.url,
        code: args.code,
        clientId: args.clientId,
        timeoutMs: args.timeoutMs,
      });
      rememberDevice(deviceId, device);
      return serialJson(deviceId, device);
    }
  );

  registerSafeTool(
    server,
    "android_disconnect",
    {
      description: "Close a cached Android companion session",
      inputSchema: z.object({ deviceId: deviceIdSchema }).shape,
    },
    async (args: { deviceId?: string }) => {
      const deviceId = normalizeDeviceId(args.deviceId);
      devices.get(deviceId)?.close();
      devices.delete(deviceId);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_heartbeat",
    {
      description: "Send a heartbeat to the paired mobile companion app",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.heartbeat());
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_status",
    {
      description: "Fetch the current mobile companion state",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => json(await withDevice(args, (device) => device.status()))
  );

  registerSafeTool(
    server,
    "android_display_info",
    {
      description: "Get Android display size and density from the companion app",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => json(await withDevice(args, (device) => device.getDisplayInfo()))
  );

  registerSafeTool(
    server,
    "android_current_app",
    {
      description: "Get the currently focused Android package/activity from the companion app",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => json(await withDevice(args, (device) => device.currentApp()))
  );

  registerSafeTool(
    server,
    "android_launch_app",
    {
      description: "Launch an Android app by package name through the companion app",
      inputSchema: z.object({ ...sessionSchema, packageName: z.string() }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      packageName: string;
      timeoutMs?: number;
    }) => json(await withDevice(args, (device) => device.launchApp(args.packageName)))
  );

  registerSafeTool(
    server,
    "android_dump_tree",
    {
      description: "Dump the Android accessibility tree through the companion app",
      inputSchema: z.object({ ...sessionSchema, ...treeOptionsSchema }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
      maxDepth?: number;
    }) => {
      const tree = await withDevice(args, (device) =>
        device.dumpTree({ maxDepth: args.maxDepth })
      );
      return json(withAndroidCoordinateSpace({ tree }));
    }
  );

  registerSafeTool(
    server,
    "android_tap",
    {
      description: "Tap Android device coordinates through the companion app",
      inputSchema: z.object({ ...sessionSchema, x: coordinateSchema, y: coordinateSchema }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      x: number;
      y: number;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.tap(args.x, args.y));
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_swipe",
    {
      description: "Swipe Android device coordinates through the companion app",
      inputSchema: z
        .object({
          ...sessionSchema,
          from: pointSchema,
          to: pointSchema,
          durationMs: positiveDurationMsSchema.optional(),
        })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      durationMs?: number;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.swipe(args.from, args.to, {
        durationMs: args.durationMs,
      }));
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_gesture",
    {
      description: "Run a multi-stroke Android gesture through the companion app",
      inputSchema: z.object({ ...sessionSchema, strokes: z.array(gestureStrokeSchema).min(1) }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      strokes: AndroidGestureStroke[];
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.gesture(args.strokes));
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_text",
    {
      description: "Type text on an Android device through the companion app",
      inputSchema: z.object({ ...sessionSchema, text: z.string() }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      text: string;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.text(args.text));
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_keyevent",
    {
      description: "Send a key event to the paired mobile companion app",
      inputSchema: z.object({ ...sessionSchema, key: z.union([z.string(), finiteNumberSchema]) }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      key: string | number;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.keyevent(args.key));
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_back",
    {
      description: "Press Android Back through the companion app",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.back());
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_home",
    {
      description: "Press Android Home through the companion app",
      inputSchema: z.object(sessionSchema).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
    }) => {
      await withDevice(args, (device) => device.home());
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_find_element",
    {
      description: "Find the first Android accessibility element matching a query",
      inputSchema: z
        .object({ ...sessionSchema, ...elementQuerySchema, ...treeOptionsSchema })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
      [key: string]: unknown;
    }) => {
      const tree = await withDevice(args, (device) => device.dumpTree({
        maxDepth: typeof args.maxDepth === "number" ? args.maxDepth : undefined,
      }));
      const element = findElements(tree, elementQuery(args))[0];
      if (!element) throw new Error(`Android element not found: ${JSON.stringify(elementQuery(args))}`);
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_wait_for_element",
    {
      description: "Wait for an Android accessibility element matching a query",
      inputSchema: z
        .object({
          ...sessionSchema,
          ...elementQuerySchema,
          ...treeOptionsSchema,
          waitTimeoutMs: timeoutMsSchema,
          pollMs: timeoutMsSchema.optional(),
        })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
      waitTimeoutMs: number;
      pollMs?: number;
      maxDepth?: number;
      [key: string]: unknown;
    }) => {
      const element = await withDevice(args, (device) => waitForElement(device, args));
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_tap_element",
    {
      description: "Tap the center of the first Android accessibility element matching a query",
      inputSchema: z
        .object({ ...sessionSchema, ...elementQuerySchema, ...treeOptionsSchema })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
      [key: string]: unknown;
    }) => {
      return withDevice(args, async (device) => {
        const tree = await device.dumpTree({
          maxDepth: typeof args.maxDepth === "number" ? args.maxDepth : undefined,
        });
        const element = findElements(tree, elementQuery(args))[0];
        if (!element) throw new Error(`Android element not found: ${JSON.stringify(elementQuery(args))}`);
        await device.tap(element.center.x, element.center.y);
        return json(withAndroidCoordinateSpace({ element }));
      });
    }
  );

  registerSafeTool(
    server,
    "android_type_element",
    {
      description: "Tap an Android accessibility element and type text",
      inputSchema: z
        .object({
          ...sessionSchema,
          ...elementQuerySchema,
          ...treeOptionsSchema,
          textToType: z.string(),
        })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      textToType: string;
      timeoutMs?: number;
      [key: string]: unknown;
    }) => {
      return withDevice(args, async (device) => {
        const tree = await device.dumpTree({
        maxDepth: typeof args.maxDepth === "number" ? args.maxDepth : undefined,
      });
        const element = findElements(tree, elementQuery(args))[0];
        if (!element) throw new Error(`Android element not found: ${JSON.stringify(elementQuery(args))}`);
        await device.tap(element.center.x, element.center.y);
        await device.text(args.textToType);
        return json(withAndroidCoordinateSpace({ element }));
      });
    }
  );

  registerSafeTool(
    server,
    "android_find_template",
    {
      description: "Find an image template on an Android device screenshot",
      inputSchema: z
        .object({
          ...sessionSchema,
          image: templateImageSchema,
          ...matchOptionsSchema,
          all: z.boolean().optional(),
        })
        .shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      image: z.infer<typeof templateImageSchema>;
      all?: boolean;
      timeoutMs?: number;
      confidence?: number;
      region?: { left: number; top: number; width: number; height: number };
      scale?: boolean | { min?: number; max?: number; step?: number };
    }) => {
      const needle = decodeTemplateImage(args.image);
      void needle;
      throw new Error("Android companion screen capture/template matching is not implemented yet");
    }
  );

  registerSafeTool(
    server,
    "android_capture_screen",
    {
      description: "Capture the Android device screen through the companion app",
      inputSchema: z.object({ ...sessionSchema, detail: captureDetailSchema }).shape,
    },
    async (args: {
      deviceId?: string;
      url?: string;
      sessionToken?: string;
      timeoutMs?: number;
      detail?: CaptureArtifactDetail;
    }) => {
      void args;
      throw new Error("Android companion screen capture is not implemented yet");
    }
  );
}
