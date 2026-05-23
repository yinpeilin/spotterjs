import { keyboard, mouse } from "@spotterjs/core";
import { ensurePaintWindow, info, moveMouseToWindowCenter, sleep } from "./lib/paint";

export async function run(): Promise<void> {
  const win = await ensurePaintWindow();

  mouse.setConfig({ autoDelayMs: 120, mouseSpeed: 1 });
  keyboard.setConfig({ autoDelayMs: 80 });

  const center = moveMouseToWindowCenter(win);
  info(`moved mouse to Paint center (${center.x},${center.y})`);

  mouse.press("left");
  mouse.move(center.x + 80, center.y);
  mouse.move(center.x + 80, center.y + 45);
  mouse.move(center.x, center.y + 45);
  mouse.release("left");
  info("drew a small rectangle-like stroke");

  await sleep(250);
  keyboard.hotkey(["Ctrl", "Z"]);
  info("sent Ctrl+Z to undo the demo stroke");
}

const isDirect =
  process.argv[1]?.replace(/\\/g, "/").includes("05-keyboard-mouse") ?? false;

if (isDirect) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
