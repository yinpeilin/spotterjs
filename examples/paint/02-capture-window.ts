import { capturePaintWindow, ensurePaintWindow } from "./lib/paint";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  capturePaintWindow(win, "paint-window.png");
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("02-capture-window") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
