import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { encodePngBase64 } from "@spotterjs/core";
import { android } from "@spotterjs/plugin-android-adb";

const adbOptionsSchema = {
  adbPath: z.string().optional(),
  timeoutMs: z.number().optional(),
};

const serialSchema = {
  serial: z.string(),
  ...adbOptionsSchema,
};

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

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
  searchRegion: regionSchema,
  multiScale: z.boolean().optional(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleStep: z.number().optional(),
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

function ok(text = "ok") {
  return { content: [{ type: "text" as const, text }] };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

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

type ToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: "image/png" }
  >;
  isError?: boolean;
};

function registerSafeTool<T>(
  server: McpServer,
  name: string,
  config: { description?: string; inputSchema?: z.ZodRawShape },
  handler: (args: T) => Promise<ToolResult>
) {
  server.registerTool(name, config, async (args) => {
    try {
      return await handler(args as T);
    } catch (error) {
      return errorResult(error);
    }
  });
}

export function registerAndroidTools(server: McpServer): void {
  registerSafeTool(
    server,
    "android_list_devices",
    {
      description: "List Android devices visible to adb",
      inputSchema: z.object(adbOptionsSchema).shape,
    },
    async (args: { adbPath?: string; timeoutMs?: number }) =>
      json(await android.listDevices(adbOptions(args)))
  );

  registerSafeTool(
    server,
    "android_connect_tcp",
    {
      description: "Connect to a network Android device with adb connect host:port",
      inputSchema: z.object({ address: z.string(), ...adbOptionsSchema }).shape,
    },
    async (args: { address: string; adbPath?: string; timeoutMs?: number }) => {
      const d = await android.connectTcp(args.address, adbOptions(args));
      return json({ serial: d.serial });
    }
  );

  registerSafeTool(
    server,
    "android_capture_screen",
    {
      description: "Capture an Android device screen; returns PNG base64",
      inputSchema: z.object(serialSchema).shape,
    },
    async (args: { serial: string; adbPath?: string; timeoutMs?: number }) => {
      const cap = await (await device(args)).capture();
      const base64 = encodePngBase64(cap);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              serial: args.serial,
              width: cap.width,
              height: cap.height,
            }),
          },
          { type: "image" as const, data: base64, mimeType: "image/png" as const },
        ],
      };
    }
  );

  registerSafeTool(
    server,
    "android_tap",
    {
      description: "Tap Android device coordinates",
      inputSchema: z.object({ ...serialSchema, x: z.number(), y: z.number() }).shape,
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
          durationMs: z.number().optional(),
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
      inputSchema: z.object({ ...serialSchema, key: z.union([z.string(), z.number()]) }).shape,
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
      searchRegion?: { left: number; top: number; width: number; height: number };
      multiScale?: boolean;
      scaleMin?: number;
      scaleMax?: number;
      scaleStep?: number;
    }) => {
      const { image, all, adbPath, timeoutMs, serial, ...options } = args;
      const d = await device({ serial, adbPath, timeoutMs });
      const needle = decodeTemplateImage(image);
      const matches = all
        ? await d.findAll(needle, options)
        : [await d.find(needle, options)];
      return json({ matches, coordinateSpace: "android-device" });
    }
  );
}
