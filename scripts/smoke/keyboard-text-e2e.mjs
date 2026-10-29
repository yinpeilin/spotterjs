// Opt-in: sends real input to a temporary Windows edit control.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";
import { clipboard, keyboard, mouse, windows } from "@spotterjs/core";

if (process.platform !== "win32")
  throw new Error("This smoke requires Windows.");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = path.join(root, "packages/cli/dist/cli.js");
const { values, positionals } = parseArgs({ options: { cli: { type: "boolean" } }, allowPositionals: true });
const [selectedMode, selectedCase] = positionals;
const cliMode = !!values.cli;
const caseNames = ["ASCII", "punctuation", "Chinese", "Unicode", "LF", "CRLF", "tabs", "repeated", "long", "empty"];
if (positionals.length > 2) throw new Error("Expected [native|paste] [case name] [--cli]");
if (selectedMode && !["native", "paste"].includes(selectedMode))
  throw new Error("Select native or paste mode");
if (selectedCase && !caseNames.includes(selectedCase)) throw new Error(`Unknown case: ${selectedCase}`);
if (cliMode) assert.ok(existsSync(cliPath), "Build @spotterjs/cli before running this smoke");
const dir = mkdtempSync(path.join(tmpdir(), "spotter-keyboard-"));
const statePath = path.join(dir, "state.txt");
const title = `SpotterKeyboard-${process.pid}`;
const ps = (value) => `'${value.replaceAll("'", "''")}'`;
const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'public class KeyboardFixtureWindow { [System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr hwnd, int command); }'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
public class SlowPasteTextBox : System.Windows.Forms.TextBox {
  protected override bool ProcessCmdKey(ref System.Windows.Forms.Message m, System.Windows.Forms.Keys keyData) {
    // Legacy multiline EDIT controls do not implement Select All themselves.
    if (keyData == (System.Windows.Forms.Keys.Control | System.Windows.Forms.Keys.A)) {
      SelectAll(); return true;
    }
    return base.ProcessCmdKey(ref m, keyData);
  }
  protected override void WndProc(ref System.Windows.Forms.Message m) {
    if (m.Msg == 0x302) System.Threading.Thread.Sleep(400);
    base.WndProc(ref m);
  }
}
'@
$form = New-Object System.Windows.Forms.Form
$form.Text = ${ps(title)}
$form.TopMost = $true
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(120,120)
$form.Size = New-Object System.Drawing.Size(740,360)
$box = New-Object SlowPasteTextBox
$box.Multiline = $true
$box.AcceptsReturn = $true
$box.AcceptsTab = $true
$box.MaxLength = 1000000
$box.Dock = 'Fill'
$box.Font = New-Object System.Drawing.Font('Consolas',16)
$form.Controls.Add($box)
$statePath = ${ps(statePath)}
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 30
$timer.Add_Tick({ [System.IO.File]::WriteAllText($statePath, $box.Text, [System.Text.Encoding]::UTF8) })
$timer.Start()
$form.Add_Shown({ $form.Activate(); $box.Focus() })
$form.Show()
[void][KeyboardFixtureWindow]::ShowWindow($form.Handle, 5)
[System.Windows.Forms.Application]::Run($form)
`;
writeFileSync(statePath, "");
const child = spawn(
  "powershell.exe",
  [
    "-NoProfile",
    "-STA",
    "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64"),
  ],
  { stdio: "ignore", windowsHide: true }
);
let previousClipboard;
let fixtureError;
child.on("error", (error) => { fixtureError = error; });
const outcomes = [];
try {
  previousClipboard = clipboard.get();
} catch {
  /* Clipboard need not contain text. */
}

async function typeText(text, options) {
  if (!cliMode) return keyboard.write(text, options);
  const result = JSON.parse(execFileSync(
    process.execPath,
    [cliPath, "run", "desktop_keyboard_type", "--stdin"],
    {
      input: JSON.stringify({ text, ...options }),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      cwd: root,
    }
  ));
  assert.equal(result.success, true, JSON.stringify(result));
}

async function stateEquals(expected) {
  let actual = "";
  for (let i = 0; i < 500; i++) {
    try {
      actual = readFileSync(statePath, "utf8").replace(/^\uFEFF/, "");
    } catch {
      /* Writer may hold the file. */
    }
    if (actual === expected) return;
    await sleep(30);
  }
  assert.equal(
    actual.length,
    expected.length,
    `Text length mismatch: received ${actual.length}, expected ${expected.length}`
  );
  assert.equal(actual, expected);
}

try {
  if (cliMode) console.log("Typing through the CLI with JSON stdin");
  let win;
  for (let i = 0; i < 80 && !win; i++) {
    if (fixtureError) throw fixtureError;
    if (child.exitCode !== null) throw new Error(`Keyboard fixture exited with ${child.exitCode}`);
    win = windows.list().find((w) => w.title === title);
    if (!win) await sleep(100);
  }
  assert.ok(win, "Keyboard fixture window did not open");
  const region = windows.getRegion(win.id);
  async function focus() {
    for (let i = 0; i < 20; i++) {
      windows.focus(win.id);
      await sleep(100);
      mouse.tap(region.left + 180, region.top + 100);
      await sleep(100);
      if (windows.getActive().id === win.id) return;
    }
    throw new Error("Refusing to type into a different window");
  }
  await focus();

  const cases = [
    ["ASCII", "Hello world 123 AbCdEf"],
    ["punctuation", "!@#$%^&*()_+-=[]{};:'\"\\|,<.>/?`~"],
    ["Chinese", "你好，世界！中文连续输入测试。"],
    ["Unicode", "café Ω 日本語 한국어 😀🚀𠮷 e\u0301"],
    ["LF", "first\nsecond\nthird"],
    ["CRLF", "first\r\nsecond\r\nthird"],
    ["tabs", "left\tmiddle\tright"],
    ["repeated", "aabbcc中文中文!!??😀😀"],
    ["long", "Ab中文!😀".repeat(700)],
    ["empty", ""],
  ];
  let failures = 0;
  for (const mode of ["native", "paste"]) {
    if (selectedMode && mode !== selectedMode) continue;
    for (const [name, text] of cases) {
      if (selectedCase && name !== selectedCase) continue;
      try {
        await focus();
        keyboard.hotkey(["Ctrl", "A"]);
        keyboard.tap("Backspace");
        await stateEquals("");
        await typeText(text, { mode, autoDelayMs: 0, pasteDelayMs: 600 });
        await stateEquals(
          mode === "paste" ? text : text.replace(/\r\n|\r|\n/g, "\r\n")
        );
        console.log(`[PASS] ${mode}/${name} (${text.length} UTF-16 units)`);
        outcomes.push({ mode, name, status: "passed", utf16Units: text.length });
      } catch (error) {
        failures++;
        console.error(`[FAIL] ${mode}/${name}: ${String(error).slice(0, 350)}`);
        outcomes.push({ mode, name, status: "failed", error: String(error) });
      }
    }
  }
  await focus();
  keyboard.hotkey(["Ctrl", "A"]);
  keyboard.tap("Backspace");
  await stateEquals("");
  for (const text of ["first ", "第二段 ", "!@#$ ", "😀 end"]) {
    await typeText(text, { autoDelayMs: 0 });
  }
  try {
    await stateEquals("first 第二段 !@#$ 😀 end");
    console.log("[PASS] consecutive default writes");
  } catch (error) {
    failures++;
    console.error(
      `[FAIL] consecutive default writes: ${String(error).slice(0, 350)}`
    );
  }
  const shiftHeld = () =>
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Add-Type -TypeDefinition 'public static class KeyState { [System.Runtime.InteropServices.DllImport(\"user32.dll\")] public static extern short GetAsyncKeyState(int key); }'; [bool]([KeyState]::GetAsyncKeyState(160) -band 0x8000)",
      ],
      { encoding: "utf8", windowsHide: true }
    ).trim() === "True";
  assert.equal(
    shiftHeld(),
    false,
    "Release Shift before running the keyboard smoke"
  );
  try {
    keyboard.down(["Shift"]);
    assert.equal(
      shiftHeld(),
      true,
      "down() must keep Shift held across API calls"
    );
  } finally {
    keyboard.up(["Shift"]);
  }
  assert.equal(shiftHeld(), false, "up() must release held Shift");
  console.log("[PASS] held modifier survives across API calls and releases");
  const evidence = path.join(root, "test-output/keyboard-cli");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(path.join(evidence, "result.json"), `${JSON.stringify({
    status: failures ? "failed" : "passed", cliMode, cases: outcomes,
    extraChecks: ["consecutive default writes", "held modifier release"],
  }, null, 2)}\n`);
  assert.equal(failures, 0, `${failures} real-window keyboard cases failed`);
} finally {
  if (previousClipboard !== undefined) clipboard.set(previousClipboard);
  if (child.pid) {
    try {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      /* Already closed. */
    }
  }
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
  assert.ok(path.basename(dir).startsWith("spotter-keyboard-"));
  rmSync(dir, { recursive: true, force: true });
}
