import { ensurePaintWindow, formatScore, info, tapPaintTool } from "./lib/paint";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  const match = tapPaintTool(win);
  info(
    `clicked match center (${match.center.x},${match.center.y}) score=${formatScore(match.score)}`
  );
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("04-click-tool") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
