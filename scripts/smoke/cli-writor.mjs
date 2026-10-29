// Read-only CLI smoke against an already running Writor desktop client.
// Build first: npm run build:ts
// Run: node scripts/smoke/cli-writor.mjs [--allow-missing] [--process-id PID] [--focus] [--workspace path]
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "packages/cli/dist/cli.js");
const { values } = parseArgs({
  options: {
    "allow-missing": { type: "boolean", default: false },
    workspace: { type: "string" },
    "process-id": { type: "string" },
    focus: { type: "boolean", default: false },
  },
});
const workspace = path.resolve(values.workspace ?? path.join(root, "test-output/writor-cli"));
let report;

function run(command, args = {}) {
  const result = spawnSync(
    process.execPath,
    [cli, "run", command, "--stdin", "--workspace", workspace],
    {
      cwd: root,
      input: JSON.stringify(args),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  if (result.error) throw result.error;
  let output;
  try {
    output = JSON.parse(result.stdout);
  } catch {
    throw new Error(`${command} did not return JSON: ${result.stderr || result.stdout}`);
  }
  assert.equal(result.status, 0, `${command} exited ${result.status}: ${JSON.stringify(output)}`);
  assert.equal(output.success, true, `${command} failed: ${JSON.stringify(output)}`);
  return output.data;
}

function isWritor(window) {
  const executable = path.win32.basename(window.exePath ?? window.processName ?? "");
  return /^writor(?:-desktop)?(?:\.exe)?$/i.test(executable)
    || /^writor(?:\s+[—–-]\s+.*)?$/i.test(window.title ?? "");
}

try {
  assert.equal(process.platform, "win32", "This desktop smoke requires Windows.");
  assert.ok(existsSync(cli), "Build @spotterjs/cli before running this smoke.");
  mkdirSync(workspace, { recursive: true });
  const selectedPid = values["process-id"] === undefined ? undefined : Number(values["process-id"]);
  if (selectedPid !== undefined) assert.ok(Number.isSafeInteger(selectedPid) && selectedPid > 0, "--process-id requires a positive integer");
  const windows = run("desktop_list_windows");
  assert.ok(Array.isArray(windows), "desktop_list_windows must return a window array");
  const matches = windows.filter((candidate) => isWritor(candidate) && (selectedPid === undefined || candidate.processId === selectedPid));
  assert.ok(matches.length <= 1, "Multiple Writor windows found; select the intended client with --process-id");
  const window = matches[0];
  if (!window) {
    report = { status: "skipped", reason: selectedPid === undefined ? "No running Writor desktop window was found." : `No Writor window was found for process ${selectedPid}.` };
    if (!values["allow-missing"]) process.exitCode = 1;
  } else {
    assert.notEqual(window.isMinimized, true, "Restore Writor before running the capture smoke.");
    if (values.focus) {
      run("desktop_focus_window", { windowId: window.id });
      const active = run("desktop_get_active_window");
      assert.equal(active.id, window.id, "Writor did not become the foreground window");
    }
    const capture = run("desktop_capture_window", { windowId: window.id, detail: "original" });
    assert.equal(capture.windowId, window.id);
    assert.equal(capture.detail, "original");
    assert.equal(capture.isDownscaled, false);
    assert.ok(capture.width > 0 && capture.height > 0, "Capture dimensions must be positive");
    assert.equal(capture.originalWidth, capture.width);
    assert.equal(capture.originalHeight, capture.height);
    const imagePath = path.resolve(workspace, capture.imagePath);
    const relative = path.relative(workspace, imagePath);
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Capture must stay in the workspace");
    const bytes = readFileSync(imagePath);
    assert.ok(bytes.length >= 24, "Capture PNG must contain its dimensions");
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
    assert.equal(bytes.readUInt32BE(16), capture.width, "PNG width must match CLI metadata");
    assert.equal(bytes.readUInt32BE(20), capture.height, "PNG height must match CLI metadata");
    report = {
      status: "passed",
      checks: ["CLI JSON stdout", "Writor discovery", ...(values.focus ? ["foreground focus verification"] : []), "native window capture", "original PNG dimensions"],
      coverage: "Desktop discovery and capture; inspect the screenshot separately to assess application readiness.",
      window: { id: window.id, title: window.title, processId: window.processId },
      capture: { ...capture, absoluteImagePath: imagePath },
    };
  }
} catch (error) {
  report = { status: "failed", error: error instanceof Error ? error.message : String(error) };
  process.exitCode = 1;
}
mkdirSync(workspace, { recursive: true });
writeFileSync(path.join(workspace, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
