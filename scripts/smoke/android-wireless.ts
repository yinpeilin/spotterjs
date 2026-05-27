import { AdbError, android } from "@spotterjs/plugin-android-adb";
import type { AndroidElementNode } from "@spotterjs/plugin-android-adb";
import { info, runSmokeScript } from "../lib/log";

interface WirelessSmokeConfig {
  adbPath?: string;
  host: string;
  connectPort: number;
  pairPort?: number;
  pairCode?: string;
  timeoutMs: number;
  capture?: boolean;
}

const WIRELESS_CONFIG: WirelessSmokeConfig = {
  // Optional. Leave undefined to use PATH or the common Android SDK locations.
  adbPath: undefined,

  // Fill these from Android Settings > Developer options > Wireless debugging.
  host: "192.168.0.200",
  connectPort: 41605,

  // Fill these only when pairing a new phone. Leave both undefined after pairing.
  pairPort: undefined,
  pairCode: undefined,

  timeoutMs: 30_000,

  // Screenshot decoding uses @spotterjs/node native bindings. Keep this false
  // when you only want to verify wireless ADB connectivity.
  capture: false,
};

export async function run(): Promise<void> {
  const config = validateConfig(WIRELESS_CONFIG);
  const options = {
    adbPath: config.adbPath,
    timeoutMs: config.timeoutMs,
  };

  if (config.pairPort !== undefined || config.pairCode !== undefined) {
    if (config.pairPort === undefined || config.pairCode === undefined) {
      throw new Error(
        "WIRELESS_CONFIG.pairPort and WIRELESS_CONFIG.pairCode must be set together"
      );
    }
    info(`pairing ${config.host}:${config.pairPort}`);
    await android.pairTcp({
      host: config.host,
      port: config.pairPort,
      code: config.pairCode,
      ...options,
    });
  }

  info(`connecting ${config.host}:${config.connectPort}`);
  const device = await connectNetworkWithDiagnostics(config, options);

  const [deviceInfo, display, currentApp, tree] = await Promise.all([
    device.getInfo(),
    device.getDisplayInfo(),
    device.currentApp(),
    device.dumpTree({ maxDepth: 4 }),
  ]);

  info(
    `device: ${deviceInfo.serial} ${deviceInfo.model ?? ""} ${deviceInfo.state}`.trim()
  );
  info(
    `display: ${display.width}x${display.height}${
      display.density ? ` @ ${display.density}dpi` : ""
    }`
  );
  info(
    `current app: ${
      currentApp.packageName
        ? `${currentApp.packageName}/${currentApp.activity ?? ""}`
        : "unknown"
    }`
  );

  const treeSummary = summarizeTree(tree);
  info(`ui tree: ${treeSummary.nodes} nodes, max depth ${treeSummary.maxDepth}`);

  if (config.capture) {
    const capture = await device.capture();
    info(`capture: ${capture.width}x${capture.height}`);
  }
}

async function connectNetworkWithDiagnostics(
  config: WirelessSmokeConfig,
  options: { adbPath?: string; timeoutMs: number }
) {
  try {
    return await android.connectNetwork({
      host: config.host,
      port: config.connectPort,
      ...options,
    });
  } catch (error) {
    if (error instanceof AdbError && error.code === "ADB_DEVICE_NOT_FOUND") {
      const devices = error.devices ?? (await android.discover(options).catch(() => []));
      const listed =
        devices.length === 0
          ? "none"
          : devices
              .map((device) =>
                `${device.serial} ${device.state} ${device.model ?? ""}`.trim()
              )
              .join("; ");
      throw new Error(
        [
          error.message,
          `adb devices: ${listed}`,
          "Check that WIRELESS_CONFIG.connectPort is the connection port from the Wireless debugging main screen, not the pairing port.",
          "If the phone shows an authorization prompt, accept it and run the script again.",
        ].join("\n")
      );
    }
    throw error;
  }
}

function validateConfig(config: WirelessSmokeConfig): WirelessSmokeConfig {
  const host = required(config.host, "WIRELESS_CONFIG.host");
  const connectPort = requiredPort(
    config.connectPort,
    "WIRELESS_CONFIG.connectPort"
  );
  const pairPort =
    config.pairPort === undefined
      ? undefined
      : requiredPort(config.pairPort, "WIRELESS_CONFIG.pairPort");
  const pairCode = config.pairCode?.trim() || undefined;
  const timeoutMs = requiredPositiveInt(
    config.timeoutMs,
    "WIRELESS_CONFIG.timeoutMs",
    1,
    Number.MAX_SAFE_INTEGER
  );

  return {
    adbPath: config.adbPath?.trim() || undefined,
    host,
    connectPort,
    pairPort,
    pairCode,
    timeoutMs,
    capture: config.capture ?? false,
  };
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function requiredPort(value: number, name: string): number {
  return requiredPositiveInt(value, name, 1, 65_535);
}

function requiredPositiveInt(
  value: number,
  name: string,
  min: number,
  max: number
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function summarizeTree(tree: AndroidElementNode): { nodes: number; maxDepth: number } {
  const summary = { nodes: 0, maxDepth: 0 };
  visit(tree, summary);
  return summary;
}

function visit(
  node: AndroidElementNode,
  summary: { nodes: number; maxDepth: number }
): void {
  summary.nodes += 1;
  summary.maxDepth = Math.max(summary.maxDepth, node.depth);
  for (const child of node.children) {
    visit(child, summary);
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("android-wireless") ?? false;

if (isDirect) {
  void runSmokeScript(
    "android-wireless",
    async () => {
      try {
        await run();
      } catch (error) {
        if (error instanceof AdbError && error.code === "ADB_NOT_FOUND") {
          throw new Error(
            "adb executable not found; install Android SDK platform-tools or set WIRELESS_CONFIG.adbPath"
          );
        }
        throw error;
      }
    }
  ).catch(() => {
    process.exitCode = 1;
  });
}
