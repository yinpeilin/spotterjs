import { ensurePaintWindow, info } from "./lib/paint";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  info(`focused Paint at (${win.region.left},${win.region.top})`);
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("01-open-focus") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
