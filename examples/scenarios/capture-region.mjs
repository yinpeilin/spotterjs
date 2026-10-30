/** Consume real CLI capture metadata without clicking or changing desktop focus. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const values = process.argv.slice(2);
if (values.length !== 0 && values.length !== 4) throw new Error("Pass left top width height, or no arguments for a 200x200 capture.");
const [left, top, width, height] = values.length ? values.map(Number) : [0, 0, 200, 200];
if (![left, top, width, height].every(Number.isSafeInteger) || width <= 0 || height <= 0)
  throw new Error("Capture coordinates must be integers and dimensions must be positive.");
const cli = fileURLToPath(new URL("../../packages/cli/dist/cli.js", import.meta.url));
const result = JSON.parse(execFileSync(process.execPath, [
  cli, "run", "desktop_capture_screen", "--json",
  JSON.stringify({ region: { left, top, width, height }, detail: "original" }),
], { encoding: "utf8", windowsHide: true }));
assert.equal(result.success, true);
assert.equal(result.data.coordinateSpace, "screen");
assert.deepEqual(result.data.origin, { x: left, y: top });
const capture = result.data;
// This is a geometric example, not a detected UI target. No action is performed.
const previewPoint = { x: capture.width / 2, y: capture.height / 2 };
const screenPoint = {
  x: capture.origin.x + previewPoint.x * capture.originalWidth / capture.width,
  y: capture.origin.y + previewPoint.y * capture.originalHeight / capture.height,
};
console.log(JSON.stringify({ capture, previewPoint, screenPoint }));
