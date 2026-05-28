import { android } from "../../packages/plugin-android/src";
import { info, runSmokeScript } from "../lib/log";

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function timeoutMs(): number | undefined {
  const value = optionalEnv("SPOTTERJS_ANDROID_TIMEOUT_MS");
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("SPOTTERJS_ANDROID_TIMEOUT_MS must be a non-negative number");
  }
  return parsed;
}

export async function run(): Promise<void> {
  const url = optionalEnv("SPOTTERJS_ANDROID_URL") ?? "ws://127.0.0.1:17341";
  const code = optionalEnv("SPOTTERJS_ANDROID_CODE");
  const sessionToken = optionalEnv("SPOTTERJS_ANDROID_SESSION_TOKEN");
  const timeout = timeoutMs();

  if (!code && !sessionToken) {
    throw new Error(
      "Set SPOTTERJS_ANDROID_CODE to pair, or SPOTTERJS_ANDROID_SESSION_TOKEN to reuse a paired companion session"
    );
  }

  const device = code
    ? await android.pair({
        url,
        code,
        clientId: optionalEnv("SPOTTERJS_ANDROID_CLIENT_ID") ?? "spotterjs-smoke",
        timeoutMs: timeout,
      })
    : await android.connect({
        url,
        sessionToken: sessionToken!,
        timeoutMs: timeout,
      });

  try {
    info(`connected ${device.url}`);
    info(`sessionToken ${device.sessionToken}`);
    await device.heartbeat();
    info("heartbeat ok");

    const status = await device.status();
    info(`status ${JSON.stringify(status)}`);

    const display = await device.getDisplayInfo();
    info(`display ${display.width}x${display.height}${display.density ? ` @${display.density}` : ""}`);

    const currentApp = await device.currentApp();
    info(`currentApp ${JSON.stringify(currentApp)}`);

    const tree = await device.dumpTree({ maxDepth: 2 });
    info(`tree root ${tree.className || "<unknown>"} children=${tree.children?.length ?? 0}`);
  } finally {
    device.close();
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("android-companion") ?? false;

if (isDirect) {
  void runSmokeScript("android-companion", run);
}
