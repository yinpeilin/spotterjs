import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { clipboard, keyboard, mouse, windows } from "../../packages/core/dist/index.js";

function psString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formScript(title, statePath) {
  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = ${psString(title)}
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(120,120)
$form.Size = New-Object System.Drawing.Size(640,320)
$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.AcceptsReturn = $true
$box.AcceptsTab = $true
$box.Dock = 'Fill'
$box.Font = New-Object System.Drawing.Font('Consolas',16)
$form.Controls.Add($box)
$statePath = ${psString(statePath)}
$box.Add_TextChanged({ Set-Content -LiteralPath $statePath -Value $box.Text -NoNewline -Encoding UTF8 })
$form.Add_Activated({ $box.Focus(); $box.Select() })
$form.Add_Shown({ $form.Activate(); $box.Focus(); $box.Select() })
[System.Windows.Forms.Application]::Run($form)
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWindow(title) {
  for (let i = 0; i < 80; i += 1) {
    const win = windows.list().find((w) => String(w.title || "") === title);
    if (win) return win;
    await sleep(250);
  }
  throw new Error(`WinForms window not found: ${title}`);
}

async function focusAndWait(windowId, title) {
  for (let i = 0; i < 20; i += 1) {
    windows.focus(windowId);
    await sleep(150);
    const active = windows.active();
    if (active.id === windowId || active.title === title) {
      return active;
    }
  }
  return windows.active();
}

async function waitForState(statePath, expected) {
  for (let i = 0; i < 40; i += 1) {
    const actual = fs.existsSync(statePath)
      ? fs.readFileSync(statePath, "utf8").replace(/^\uFEFF/, "")
      : "";
    if (actual === expected) return actual;
    await sleep(100);
  }
  return fs.existsSync(statePath)
    ? fs.readFileSync(statePath, "utf8").replace(/^\uFEFF/, "")
    : "";
}

async function runCase(name, write) {
  const title = `SpotterFillTextE2E-${name}-${Date.now()}`;
  const statePath = path.join(os.tmpdir(), `${title}.txt`);
  fs.writeFileSync(statePath, "", "utf8");
  const child = childProcess.spawn(
    "powershell.exe",
    ["-NoProfile", "-STA", "-Command", formScript(title, statePath)],
    { stdio: "ignore" }
  );

  try {
    const win = await waitForWindow(title);
  console.log(`target=${JSON.stringify({
    id: win.id,
    title: win.title,
    region: win.region,
    isForeground: win.isForeground,
  })}`);

  const active = await focusAndWait(win.id, win.title);
  console.log(`active=${JSON.stringify(active)}`);
  if (active.id !== win.id && active.title !== win.title) {
    throw new Error(`failed to focus test window; active=${active.title}`);
  }

  await sleep(300);
  const region = windows.region(win.id);
  mouse.tap(
    region.left + Math.floor(region.width / 2),
    region.top + 80
  );
  await sleep(600);

    const expected = await write();
    const actual = await waitForState(statePath, expected);
    console.log(`${name}State=${JSON.stringify(actual)}`);
    if (actual !== expected) {
      throw new Error(
        `${name} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
      );
    }
    return actual;
  } finally {
    if (child.pid) {
      try {
        childProcess.execFileSync(
          "taskkill.exe",
          ["/PID", String(child.pid), "/T", "/F"],
          { stdio: "ignore" }
        );
      } catch {
        // The window may already be closed.
      }
    }
    try {
      fs.unlinkSync(statePath);
    } catch {
      // Best-effort cleanup.
    }
  }
}

async function run() {
  await runCase("paste", async () => {
    const previous = `previous-${Date.now()}`;
    clipboard.set(previous);
    const text = `paste-${Date.now()} \u4e2d\u6587 caf\u00e9 123`;
    keyboard.write(text, { restoreClipboard: true });
    await sleep(500);
    console.log(`clipboardAfterPaste=${JSON.stringify(clipboard.get())}`);
    if (clipboard.get() !== previous) {
      throw new Error("clipboard was not restored after paste-mode write");
    }
    return text;
  });

  await runCase("native", async () => {
    const text = `native-${Date.now()} Unicode \u03a9 456`;
    keyboard.write(text, { mode: "native", autoDelayMs: 20 });
    await sleep(500);
    return text;
  });
  console.log("fill text e2e ok");
}

await run();
