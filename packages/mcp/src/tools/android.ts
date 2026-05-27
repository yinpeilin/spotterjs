import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { android } from "@spotterjs/plugin-android-adb";
import {
  type CaptureArtifactDetail,
  workspaceImageStore,
} from "../adapters/artifacts.js";
import { json, ok, registerSafeTool } from "./results.js";

const finiteNumberSchema = z.number().finite();
const coordinateSchema = finiteNumberSchema.min(0);
const timeoutMsSchema = finiteNumberSchema.min(0);
const positiveDurationMsSchema = finiteNumberSchema.min(0);
const portSchema = z.number().int().min(1).max(65535);
const confidenceSchema = finiteNumberSchema.min(0).max(1);
const maxDepthSchema = z.number().int().min(0).max(100);
const captureDetailSchema = z.enum(["high", "original"]).optional();

const adbOptionsSchema = {
  adbPath: z.string().optional(),
  timeoutMs: timeoutMsSchema.optional(),
};

const serialSchema = {
  serial: z.string(),
  ...adbOptionsSchema,
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

const elementOptionsSchema = {
  maxDepth: maxDepthSchema.optional(),
  remotePath: z.string().optional(),
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

function adbOptions(args: { adbPath?: string; timeoutMs?: number }) {
  return {
    adbPath: args.adbPath,
    timeoutMs: args.timeoutMs,
  };
}

async function device(args: { serial: string; adbPath?: string; timeoutMs?: number }) {
  return android.connect({
    serial: args.serial,
    ...adbOptions(args),
  });
}

function elementQuery(args: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const key of Object.keys(elementQuerySchema)) {
    if (args[key] !== undefined) query[key] = args[key];
  }
  return query;
}

function elementOptions(args: Record<string, unknown>) {
  const options: Record<string, unknown> = {};
  for (const key of Object.keys(elementOptionsSchema)) {
    if (args[key] !== undefined) options[key] = args[key];
  }
  if (args.pollMs !== undefined) options.pollMs = args.pollMs;
  return options;
}

function withAndroidCoordinateSpace<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    coordinateSpace: "android-device",
  };
}

function serialJson(device: { serial: string }) {
  return json({ serial: device.serial });
}

function captureArtifactJson(
  serial: string,
  capture: Parameters<typeof workspaceImageStore.writeCapture>[0],
  extra: Record<string, unknown> = {},
  options: { detail?: CaptureArtifactDetail } = {}
) {
  return {
    serial,
    ...extra,
    ...workspaceImageStore.writeCapture(capture, {
      prefix: `android-${serial}`,
      detail: options.detail,
    }),
  };
}

async function connectAllDevices(args: { adbPath?: string; timeoutMs?: number }) {
  return android.connectAll(adbOptions(args));
}

export function registerAndroidTools(server: McpServer): void {
  registerSafeTool(
    server,
    "android_discover_devices",
    {
      description: "Discover Android devices currently visible to adb",
      inputSchema: z.object(adbOptionsSchema).shape,
    },
    async (args: { adbPath?: string; timeoutMs?: number }) =>
      json(await android.discover(adbOptions(args)))
  );

  registerSafeTool(
    server,
    "android_pair_tcp",
    {
      description: "Pair an Android 11+ wireless debugging device with adb pair",
      inputSchema: z
        .object({
          host: z.string(),
          port: portSchema,
          code: z.string(),
          ...adbOptionsSchema,
        })
        .shape,
    },
    async (args: {
      host: string;
      port: number;
      code: string;
      adbPath?: string;
      timeoutMs?: number;
    }) => {
      await android.pairTcp({
        host: args.host,
        port: args.port,
        code: args.code,
        ...adbOptions(args),
      });
      return json({ ok: true });
    }
  );

  registerSafeTool(
    server,
    "android_connect_network",
    {
      description: "Connect a paired wireless Android device with adb connect",
      inputSchema: z.object({ host: z.string(), port: portSchema, ...adbOptionsSchema }).shape,
    },
    async (args: { host: string; port: number; adbPath?: string; timeoutMs?: number }) =>
      serialJson(
        await android.connectNetwork({
          host: args.host,
          port: args.port,
          ...adbOptions(args),
        })
      )
  );

  registerSafeTool(
    server,
    "android_connect_default",
    {
      description: "Connect the only available Android device discovered by adb",
      inputSchema: z.object(adbOptionsSchema).shape,
    },
    async (args: { adbPath?: string; timeoutMs?: number }) =>
      serialJson(await android.connectDefault(adbOptions(args)))
  );

  registerSafeTool(
    server,
    "android_connect_all",
    {
      description: "Connect all available Android devices discovered by adb",
      inputSchema: z.object(adbOptionsSchema).shape,
    },
    async (args: { adbPath?: string; timeoutMs?: number }) => {
      const group = await connectAllDevices(args);
      return json({
        devices: group.devices.map((d) => ({ serial: d.serial })),
        skipped: group.skipped,
      });
    }
  );

  registerSafeTool(
    server,
    "android_capture_screen",
    {
      description:
        "Capture an Android device screen, downscale long edge to 1600 by default, and return a workspace PNG file path",
      inputSchema: z.object({ ...serialSchema, detail: captureDetailSchema }).shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      detail?: CaptureArtifactDetail;
    }) => {
      const cap = await (await device(args)).capture();
      return json(captureArtifactJson(args.serial, cap, {}, { detail: args.detail }));
    }
  );

  registerSafeTool(
    server,
    "android_batch_tap",
    {
      description: "Tap coordinates on every available Android device discovered by adb",
      inputSchema: z.object({ x: coordinateSchema, y: coordinateSchema, ...adbOptionsSchema }).shape,
    },
    async (args: { x: number; y: number; adbPath?: string; timeoutMs?: number }) => {
      const group = await connectAllDevices(args);
      return json(await group.tapAll(args.x, args.y));
    }
  );

  registerSafeTool(
    server,
    "android_batch_swipe",
    {
      description: "Swipe coordinates on every available Android device discovered by adb",
      inputSchema: z
        .object({
          from: pointSchema,
          to: pointSchema,
          durationMs: positiveDurationMsSchema.optional(),
          ...adbOptionsSchema,
        })
        .shape,
    },
    async (args: {
      from: { x: number; y: number };
      to: { x: number; y: number };
      durationMs?: number;
      adbPath?: string;
      timeoutMs?: number;
    }) => {
      const group = await connectAllDevices(args);
      return json(
        await group.swipeAll(args.from, args.to, {
          durationMs: args.durationMs,
        })
      );
    }
  );

  registerSafeTool(
    server,
    "android_batch_capture",
    {
      description:
        "Capture every available Android device discovered by adb and return workspace PNG file paths",
      inputSchema: z.object({ ...adbOptionsSchema, detail: captureDetailSchema }).shape,
    },
    async (args: {
      adbPath?: string;
      timeoutMs?: number;
      detail?: CaptureArtifactDetail;
    }) => {
      const group = await connectAllDevices(args);
      const results = await group.captureAll();
      const summary = results.map((result) => {
        if (!result.ok || !result.value) {
          return {
            serial: result.serial,
            ok: false,
            error: result.error,
          };
        }
        return captureArtifactJson(
          result.serial,
          result.value,
          { ok: true },
          { detail: args.detail }
        );
      });
      return json(summary);
    }
  );

  registerSafeTool(
    server,
    "android_tap",
    {
      description: "Tap Android device coordinates",
      inputSchema: z.object({ ...serialSchema, x: coordinateSchema, y: coordinateSchema }).shape,
    },
    async (args: { serial: string; x: number; y: number; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).tap(args.x, args.y);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_swipe",
    {
      description: "Swipe Android device coordinates",
      inputSchema: z
        .object({
          ...serialSchema,
          from: pointSchema,
          to: pointSchema,
          durationMs: positiveDurationMsSchema.optional(),
        })
        .shape,
    },
    async (args: {
      serial: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
      durationMs?: number;
      adbPath?: string;
      timeoutMs?: number;
    }) => {
      await (await device(args)).swipe(args.from, args.to, {
        durationMs: args.durationMs,
      });
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_type_text",
    {
      description: "Type text on an Android device using adb shell input text",
      inputSchema: z.object({ ...serialSchema, text: z.string() }).shape,
    },
    async (args: { serial: string; text: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).text(args.text);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_keyevent",
    {
      description: "Send adb input keyevent to an Android device",
      inputSchema: z.object({ ...serialSchema, key: z.union([z.string(), finiteNumberSchema]) }).shape,
    },
    async (args: { serial: string; key: string | number; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).keyevent(args.key);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_back",
    { description: "Press Android Back", inputSchema: z.object(serialSchema).shape },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).back();
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_home",
    { description: "Press Android Home", inputSchema: z.object(serialSchema).shape },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).home();
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_start_app",
    {
      description: "Start an Android app package/activity",
      inputSchema: z
        .object({
          ...serialSchema,
          packageName: z.string(),
          activity: z.string().optional(),
        })
        .shape,
    },
    async (args: {
      serial: string;
      packageName: string;
      activity?: string;
      adbPath?: string;
      timeoutMs?: number;
    }) => {
      await (await device(args)).startApp(args.packageName, args.activity);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_stop_app",
    {
      description: "Force-stop an Android app package",
      inputSchema: z.object({ ...serialSchema, packageName: z.string() }).shape,
    },
    async (args: { serial: string; packageName: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).stopApp(args.packageName);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_dump_tree",
    {
      description: "Dump the Android UIAutomator element tree",
      inputSchema: z.object({ ...serialSchema, ...elementOptionsSchema }).shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      maxDepth?: number;
      remotePath?: string;
    }) => {
      const { serial, adbPath, timeoutMs, ...options } = args;
      const tree = await (await device({ serial, adbPath, timeoutMs })).dumpTree(options);
      return json(withAndroidCoordinateSpace({ tree }));
    }
  );

  registerSafeTool(
    server,
    "android_find_element",
    {
      description: "Find the first Android UIAutomator element matching a query",
      inputSchema: z
        .object({ ...serialSchema, ...elementQuerySchema, ...elementOptionsSchema })
        .shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      maxDepth?: number;
      remotePath?: string;
      [key: string]: unknown;
    }) => {
      const d = await device(args);
      const element = await d.findElement(elementQuery(args), elementOptions(args));
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_wait_for_element",
    {
      description: "Wait for an Android UIAutomator element matching a query",
      inputSchema: z
        .object({
          ...serialSchema,
          ...elementQuerySchema,
          ...elementOptionsSchema,
          waitTimeoutMs: timeoutMsSchema,
          pollMs: timeoutMsSchema.optional(),
        })
        .shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      waitTimeoutMs: number;
      pollMs?: number;
      maxDepth?: number;
      remotePath?: string;
      [key: string]: unknown;
    }) => {
      const d = await device({
        serial: args.serial,
        adbPath: args.adbPath,
        timeoutMs: args.timeoutMs,
      });
      const element = await d.waitForElement(
        elementQuery(args),
        args.waitTimeoutMs,
        elementOptions(args)
      );
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_tap_element",
    {
      description: "Tap the center of the first Android element matching a query",
      inputSchema: z
        .object({ ...serialSchema, ...elementQuerySchema, ...elementOptionsSchema })
        .shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      maxDepth?: number;
      remotePath?: string;
      [key: string]: unknown;
    }) => {
      const d = await device(args);
      const element = await d.tapElement(elementQuery(args), elementOptions(args));
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_type_element",
    {
      description: "Tap an Android element matching a query and type text",
      inputSchema: z
        .object({
          ...serialSchema,
          ...elementQuerySchema,
          ...elementOptionsSchema,
          textToType: z.string(),
        })
        .shape,
    },
    async (args: {
      serial: string;
      adbPath?: string;
      timeoutMs?: number;
      textToType: string;
      maxDepth?: number;
      remotePath?: string;
      [key: string]: unknown;
    }) => {
      const d = await device(args);
      const element = await d.typeElement(
        elementQuery(args),
        args.textToType,
        elementOptions(args)
      );
      return json(withAndroidCoordinateSpace({ element }));
    }
  );

  registerSafeTool(
    server,
    "android_shell",
    {
      description: "Run a raw adb shell command on an Android device",
      inputSchema: z.object({ ...serialSchema, command: z.string() }).shape,
    },
    async (args: {
      serial: string;
      command: string;
      adbPath?: string;
      timeoutMs?: number;
    }) => json({ output: await (await device(args)).shell(args.command) })
  );

  registerSafeTool(
    server,
    "android_get_display_info",
    {
      description: "Get Android display size and density from wm",
      inputSchema: z.object(serialSchema).shape,
    },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) =>
      json(await (await device(args)).getDisplayInfo())
  );

  registerSafeTool(
    server,
    "android_wake",
    { description: "Wake an Android device", inputSchema: z.object(serialSchema).shape },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).wake();
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_sleep",
    { description: "Put an Android device to sleep", inputSchema: z.object(serialSchema).shape },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).sleep();
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_current_app",
    {
      description: "Get the currently focused Android package/activity",
      inputSchema: z.object(serialSchema).shape,
    },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) =>
      json(await (await device(args)).currentApp())
  );

  registerSafeTool(
    server,
    "android_clear_app",
    {
      description: "Clear Android app data with pm clear",
      inputSchema: z.object({ ...serialSchema, packageName: z.string() }).shape,
    },
    async (args: { serial: string; packageName: string; adbPath?: string; timeoutMs?: number }) => {
      await (await device(args)).clearApp(args.packageName);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "android_find_template",
    {
      description: "Find an image template on an Android device screenshot",
      inputSchema: z
        .object({
          ...serialSchema,
          image: templateImageSchema,
          ...matchOptionsSchema,
          all: z.boolean().optional(),
        })
        .shape,
    },
    async (args: {
      serial: string;
      image: z.infer<typeof templateImageSchema>;
      all?: boolean;
      adbPath?: string;
      timeoutMs?: number;
      confidence?: number;
      region?: { left: number; top: number; width: number; height: number };
      scale?: boolean | { min?: number; max?: number; step?: number };
    }) => {
      const { image, all, adbPath, timeoutMs, serial, ...options } = args;
      const d = await device({ serial, adbPath, timeoutMs });
      const needle = decodeTemplateImage(image);
      const matches = all
        ? await d.findAll(needle, options)
        : [await d.find(needle, options)];
      return json(withAndroidCoordinateSpace({ matches }));
    }
  );
}
