/** Read-only Windows/Linux desktop observation; no focus, clicks or typing. */
import { mkdirSync, writeFileSync } from "node:fs";
import { image, screen, windows } from "@spotterjs/core";

const title = process.argv[2];
const size = screen.getSize();
const candidates = title ? windows.list().filter((window) => window.title.includes(title)) : [];
if (title && candidates.length !== 1) {
  throw new Error(`Expected exactly one window for ${JSON.stringify(title)}; found ${candidates.length}. Inspect windows.list() and narrow the title.`);
}
const window = candidates[0];
const capture = window
  ? windows.capture(window.id)
  : screen.capture({ left: 0, top: 0, width: Math.min(200, size.width), height: Math.min(200, size.height) });
mkdirSync("test-output/scenarios", { recursive: true });
const output = "test-output/scenarios/desktop.png";
writeFileSync(output, image.encode(capture));
console.log(JSON.stringify({ output, windowId: window?.id, width: capture.width, height: capture.height }));
