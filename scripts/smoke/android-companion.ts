import { android, type AndroidElementNode } from "../../packages/plugin-android/src";
import { info, runSmokeScript } from "../lib/log";

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function timeoutMs(): number | undefined {
  return optionalNumberEnv("SPOTTERJS_ANDROID_TIMEOUT_MS");
}

function optionalNumberEnv(name: string): number | undefined {
  const value = optionalEnv(name);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

function elementQueryFromEnv(): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [envName, key] of [
    ["SPOTTERJS_ANDROID_WAIT_TEXT", "text"],
    ["SPOTTERJS_ANDROID_WAIT_TEXT_CONTAINS", "textContains"],
    ["SPOTTERJS_ANDROID_WAIT_RESOURCE_ID", "resourceId"],
    ["SPOTTERJS_ANDROID_WAIT_RESOURCE_ID_CONTAINS", "resourceIdContains"],
    ["SPOTTERJS_ANDROID_WAIT_CONTENT_DESCRIPTION", "contentDescription"],
    ["SPOTTERJS_ANDROID_WAIT_CONTENT_DESCRIPTION_CONTAINS", "contentDescriptionContains"],
    ["SPOTTERJS_ANDROID_WAIT_CLASS_NAME", "className"],
    ["SPOTTERJS_ANDROID_WAIT_CLASS_NAME_CONTAINS", "classNameContains"],
  ] as const) {
    const value = optionalEnv(envName);
    if (value) query[key] = value;
  }
  return query;
}

function findElement(root: AndroidElementNode, query: Record<string, string>): AndroidElementNode | undefined {
  if (matches(root, query)) return root;
  for (const child of root.children ?? []) {
    const match = findElement(child, query);
    if (match) return match;
  }
  return undefined;
}

function matches(node: AndroidElementNode, query: Record<string, string>): boolean {
  return (
    exact(node.text, query.text) &&
    contains(node.text, query.textContains) &&
    exact(node.resourceId, query.resourceId) &&
    contains(node.resourceId, query.resourceIdContains) &&
    exact(node.contentDescription, query.contentDescription) &&
    contains(node.contentDescription, query.contentDescriptionContains) &&
    exact(node.className, query.className) &&
    contains(node.className, query.classNameContains)
  );
}

function exact(value: string, expected?: string): boolean {
  return expected === undefined || value === expected;
}

function contains(value: string, expected?: string): boolean {
  return expected === undefined || value.includes(expected);
}

async function waitForElement(
  device: Awaited<ReturnType<typeof android.pair>>,
  query: Record<string, string>
): Promise<AndroidElementNode> {
  const waitTimeoutMs = optionalNumberEnv("SPOTTERJS_ANDROID_WAIT_TIMEOUT_MS") ?? 5_000;
  const pollMs = optionalNumberEnv("SPOTTERJS_ANDROID_POLL_MS") ?? 250;
  const maxDepth = optionalNumberEnv("SPOTTERJS_ANDROID_TREE_MAX_DEPTH") ?? 8;
  const deadline = Date.now() + waitTimeoutMs;
  while (Date.now() <= deadline) {
    const match = findElement(await device.dumpTree({ maxDepth }), query);
    if (match) return match;
    if (pollMs > 0) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Android element not found before timeout: ${JSON.stringify(query)}`);
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

    const launchPackage = optionalEnv("SPOTTERJS_ANDROID_LAUNCH_PACKAGE");
    if (launchPackage) {
      const launched = await device.launchApp(launchPackage);
      info(`launched ${JSON.stringify(launched)}`);
    }

    const query = elementQueryFromEnv();
    if (Object.keys(query).length > 0) {
      const element = await waitForElement(device, query);
      info(`matched element ${JSON.stringify({
        text: element.text,
        resourceId: element.resourceId,
        className: element.className,
        center: element.center,
      })}`);

      if (optionalEnv("SPOTTERJS_ANDROID_TAP_ELEMENT") === "1") {
        await device.tap(element.center.x, element.center.y);
        info("tap element ok");
      }

      const textToType = optionalEnv("SPOTTERJS_ANDROID_TEXT_TO_TYPE");
      if (textToType) {
        await device.tap(element.center.x, element.center.y);
        await device.text(textToType);
        info("type element ok");
      }
    }
  } finally {
    device.close();
  }
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("android-companion") ?? false;

if (isDirect) {
  void runSmokeScript("android-companion", run);
}
