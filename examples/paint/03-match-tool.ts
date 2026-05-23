import {
  capturePaintWindow,
  ensurePaintWindow,
  formatScore,
  info,
  matchPaintTool,
  TEMPLATE_PATH,
} from "./lib/paint";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();
  capturePaintWindow(win, "paint-before-match.png");

  const match = matchPaintTool(win);
  info(`template ${TEMPLATE_PATH}`);
  info(
    `matched at (${match.region.left},${match.region.top}) ${match.region.width}x${match.region.height} center=(${match.center.x},${match.center.y}) score=${formatScore(match.score)}`
  );
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("03-match-tool") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
