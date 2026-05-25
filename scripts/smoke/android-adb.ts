import { AdbError, android } from "@spotterjs/plugin-android-adb";

async function main() {
  const options = { adbPath: process.env.SPOTTERJS_ADB_PATH };
  let devices;
  try {
    devices = await android.discover(options);
  } catch (error) {
    if (error instanceof AdbError && error.code === "ADB_NOT_FOUND") {
      console.log("skip: adb executable not found");
      return;
    }
    throw error;
  }
  const available = devices.filter((device) => device.state === "device");

  if (available.length === 0) {
    console.log("skip: no authorized Android devices visible to adb");
    return;
  }

  const group = await android.connectAll(options);
  const captures = await group.captureAll();
  const diagnostics = await Promise.all(
    group.devices.map(async (device) => {
      const base = { serial: device.serial };
      try {
        const [display, tree] = await Promise.all([
          device.getDisplayInfo(),
          device.dumpTree({ maxDepth: 3 }),
        ]);
        return {
          ...base,
          display,
          tree: summarizeTree(tree),
        };
      } catch (error) {
        return {
          ...base,
          diagnosticsError: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  console.log(
    JSON.stringify(
      {
        devices,
        skipped: group.skipped,
        diagnostics,
        captures: captures.map((result) => {
          if (!result.ok || !result.value) {
            return {
              serial: result.serial,
              ok: false,
              error: result.error,
            };
          }
          return {
            serial: result.serial,
            ok: true,
            width: result.value.width,
            height: result.value.height,
          };
        }),
      },
      null,
      2
    )
  );
}

function summarizeTree(tree: { children: unknown[] }) {
  const summary = { nodes: 0, maxDepth: 0 };
  visit(tree, 0, summary);
  return summary;
}

function visit(
  node: { children?: unknown[] },
  depth: number,
  summary: { nodes: number; maxDepth: number }
) {
  summary.nodes += 1;
  summary.maxDepth = Math.max(summary.maxDepth, depth);
  for (const child of node.children ?? []) {
    if (typeof child === "object" && child !== null) {
      visit(child as { children?: unknown[] }, depth + 1, summary);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
