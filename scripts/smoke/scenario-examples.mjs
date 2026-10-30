/** Exercise runnable OCR/Android examples with fixtures; no desktop/device input. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer } from "ws";

const root = fileURLToPath(new URL("../../", import.meta.url));
const run = promisify(execFile);
async function example(file, env = {}) {
  const { stdout } = await run(process.execPath, [
    path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "examples/scenarios", file),
  ], { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", windowsHide: true, timeout: 15000 });
  return JSON.parse(stdout);
}

const ocr = await example("ocr-coordinates.ts");
assert.equal(ocr.engine, "injected-fixture");
assert.deepEqual(ocr.match.center, { x: 107, y: 207 });
const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
await new Promise((resolve) => server.once("listening", resolve));
const messages = [];
server.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello", protocolVersion: 2 }));
  socket.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    messages.push(message.type);
    assert.equal(message.sessionToken, "fixture-token");
    if (message.type === "displayInfo") socket.send(JSON.stringify({ type: "displayInfo", width: 1080, height: 2400 }));
    else if (message.type === "currentApp") socket.send(JSON.stringify({ type: "currentApp", packageName: "example.fixture" }));
    else assert.fail(`Unexpected command: ${message.type}`);
  });
});
try {
  const address = server.address();
  const android = await example("inspect-android.ts", {
    SPOTTERJS_ANDROID_URL: `ws://127.0.0.1:${address.port}`,
    SPOTTERJS_ANDROID_TOKEN: "fixture-token",
  });
  assert.deepEqual(android, { display: { width: 1080, height: 2400 }, app: { packageName: "example.fixture" } });
  assert.deepEqual(messages, ["displayInfo", "currentApp"]);
  console.log(JSON.stringify({ status: "passed", checks: ["injected OCR coordinate contract", "Android observation example against protocol-v2 fixture"] }));
} finally {
  for (const client of server.clients) client.terminate();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
