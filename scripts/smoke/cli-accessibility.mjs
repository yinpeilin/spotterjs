// Opt-in Windows desktop smoke using an isolated, temporary WinForms fixture.
// Build first, then: node scripts/smoke/cli-accessibility.mjs
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "packages/cli/dist/cli.js");
const evidence = path.join(root, "test-output/cli-accessibility");
const temporaryRoot = path.resolve(tmpdir());
const directory = mkdtempSync(path.join(temporaryRoot, "spotter-cli-a11y-"));
const statePath = path.join(directory, "text.txt");
const buttonPath = path.join(directory, "button.txt");
const decoyStatePath = path.join(directory, "decoy.txt");
const title = `SpotterCliA11y-${process.pid}-${Date.now()}`;
const fieldName = "Spotter CLI field";
const buttonName = "Spotter CLI apply";
const ps = (value) => `'${value.replaceAll("'", "''")}'`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let fixture;
let fixtureError;
let fixtureDiagnostics = "";
let report;

function run(name, args = {}, expectedSuccess = true) {
  const result = spawnSync(process.execPath, [cli, "run", name, "--stdin", "--workspace", evidence], {
    cwd: root,
    env: { ...process.env, SPOTTERJS_A11Y: "1" },
    input: JSON.stringify(args),
    encoding: "utf8",
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  let output;
  try { output = JSON.parse(result.stdout); }
  catch { throw new Error(`${name} did not return JSON: ${result.stderr || result.stdout}`); }
  assert.equal(output.success, expectedSuccess, JSON.stringify(output));
  assert.equal(result.status, expectedSuccess ? 0 : 1, JSON.stringify(output));
  return output;
}

async function waitForFile(file, expected) {
  let actual = "";
  for (let attempt = 0; attempt < 100; attempt++) {
    try { actual = readFileSync(file, "utf8").replace(/^\uFEFF/, ""); }
    catch { /* The fixture may currently be writing the state file. */ }
    if (actual === expected) return;
    await sleep(50);
  }
  assert.equal(actual, expected, `Fixture state mismatch at ${file}`);
}

try {
  assert.equal(process.platform, "win32", "This accessibility smoke requires Windows.");
  assert.ok(existsSync(cli), "Build @spotterjs/cli before running this smoke.");
  writeFileSync(statePath, "");
  writeFileSync(buttonPath, "");
  writeFileSync(decoyStatePath, "");
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'public class FixtureWindow { [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hwnd, int command); }'
$form = New-Object System.Windows.Forms.Form
$form.Text = ${ps(title)}
$form.TopMost = $true
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(180,180)
$form.Size = New-Object System.Drawing.Size(640,300)
$box = New-Object System.Windows.Forms.TextBox
$box.Name = 'SpotterCliInput'
$box.AccessibleName = ${ps(fieldName)}
$box.Multiline = $true
$box.AcceptsReturn = $true
$box.AcceptsTab = $true
$box.Dock = 'Fill'
$box.Font = New-Object System.Drawing.Font('Consolas',16)
$button = New-Object System.Windows.Forms.Button
$button.Text = ${ps(buttonName)}
$button.Name = 'SpotterCliApply'
$button.AccessibleName = ${ps(buttonName)}
$button.Dock = 'Bottom'
$button.Height = 48
$statePath = ${ps(statePath)}
$buttonPath = ${ps(buttonPath)}
$decoyStatePath = ${ps(decoyStatePath)}
$cover = New-Object System.Windows.Forms.Form
$cover.Text = ${ps(`${title}-cover`)}
$cover.TopMost = $true
$cover.StartPosition = 'Manual'
$cover.Location = $form.Location
$cover.Size = $form.Size
$panel = New-Object System.Windows.Forms.Panel
$panel.Dock = 'Fill'
$list = New-Object System.Windows.Forms.ListBox
$list.Location = New-Object System.Drawing.Point(10,10)
$list.Size = New-Object System.Drawing.Size(140,100)
1..30 | ForEach-Object { [void]$list.Items.Add("Decoy item $_") }
$decoy = New-Object System.Windows.Forms.TextBox
$decoy.AccessibleName = ${ps(fieldName)}
$decoy.Location = New-Object System.Drawing.Point(10,130)
$decoy.Size = New-Object System.Drawing.Size(140,40)
$panel.Controls.Add($list)
$panel.Controls.Add($decoy)
$cover.Controls.Add($panel)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30
$timer.Add_Tick({
  [System.IO.File]::WriteAllText($statePath, $box.Text, [System.Text.Encoding]::UTF8)
  [System.IO.File]::WriteAllText($decoyStatePath, $decoy.Text, [System.Text.Encoding]::UTF8)
})
$timer.Start()
$button.Add_Click({ [System.IO.File]::WriteAllText($buttonPath, 'clicked', [System.Text.Encoding]::UTF8) })
$form.Controls.Add($box)
$form.Controls.Add($button)
$form.Add_Shown({ $form.Activate(); $box.Focus() })
$form.Show()
[void][FixtureWindow]::ShowWindow($form.Handle, 5)
$cover.Show()
[void][FixtureWindow]::ShowWindow($cover.Handle, 5)
[System.Windows.Forms.Application]::Run($form)
`;
  fixture = spawn("powershell.exe", [
    "-NoProfile", "-STA", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64"),
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  fixture.on("error", (error) => { fixtureError = error; });
  for (const stream of [fixture.stdout, fixture.stderr]) stream.on("data", (chunk) => {
    fixtureDiagnostics = `${fixtureDiagnostics}${chunk.toString()}`.slice(-65536);
  });
  let window;
  for (let attempt = 0; attempt < 30 && !window; attempt++) {
    if (fixtureError) throw fixtureError;
    if (fixture.exitCode !== null) throw new Error(`Accessibility fixture exited with ${fixture.exitCode}: ${fixtureDiagnostics}`);
    window = run("desktop_list_windows").data.find((candidate) => candidate.title === title);
    if (!window) await sleep(100);
  }
  assert.ok(window, "Isolated accessibility fixture did not open");

  const query = { name: fieldName, controlType: "Edit" };
  const inspected = run("desktop_a11y_inspect", { windowId: window.id, query, maxDepth: 8 }).data;
  assert.equal(inspected.windowId, window.id);
  assert.equal(typeof inspected.tree, "object");
  assert.equal(inspected.elementInfo.name, fieldName);
  assert.match(inspected.elementInfo.controlType, /Edit/i);

  const expected = "Spotter CLI accessibility 中文 😀 café Ω 123";
  const typed = run("desktop_a11y_action", {
    windowId: window.id, query, action: { type: "type", text: expected },
  }).data;
  assert.equal(typed.action, "type");
  assert.equal(typed.elementInfo.name, fieldName);
  await waitForFile(statePath, expected);
  await waitForFile(decoyStatePath, "");

  const missing = run("desktop_a11y_action", {
    windowId: window.id, query: { name: "This selector must not exist" },
    action: { type: "type", text: "must not type" },
  }, false);
  assert.ok(missing.error?.message, "A missing selector must return an error");
  await waitForFile(statePath, expected);

  // A separate CLI process must reacquire the window and selector itself.
  const inspectedAgain = run("desktop_a11y_inspect", { windowId: window.id, query }).data;
  assert.equal(inspectedAgain.elementInfo.name, fieldName);
  const invoked = run("desktop_a11y_action", {
    windowId: window.id, query: { name: buttonName, controlType: "Button" }, action: { type: "invoke" },
  }).data;
  assert.equal(invoked.action, "invoke");
  await waitForFile(buttonPath, "clicked");

  report = {
    status: "passed",
    checks: ["CLI selector inspection", "covered window stays within requested target", "Unicode UIA typing", "missing selector fails without typing", "fresh-process selector reuse", "UIA button invocation", "CLI process cleanup"],
    text: expected,
    window: { id: window.id, title, processId: window.processId },
  };
} catch (error) {
  report = { status: "failed", error: error instanceof Error ? error.message : String(error), fixtureDiagnostics };
} finally {
  try {
    if (fixture?.pid) {
      spawnSync("taskkill.exe", ["/PID", String(fixture.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      let running = false;
      try { process.kill(fixture.pid, 0); running = true; } catch { /* Fixture exited. */ }
      assert.equal(running, false, "Accessibility fixture cleanup did not finish");
    }
    assert.equal(path.dirname(path.resolve(directory)), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("spotter-cli-a11y-"));
    rmSync(directory, { recursive: true, force: true });
  } catch (error) {
    report = { ...report, status: "failed", cleanupError: error instanceof Error ? error.message : String(error) };
  }
}
mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(evidence, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
if (report.status !== "passed") process.exitCode = 1;
