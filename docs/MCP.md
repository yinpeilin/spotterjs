# spotterjs MCP Server (`@spotterjs/mcp`)

The spotterjs MCP server exposes desktop automation, workspace file access, and shell execution to MCP clients (Cursor, Claude Desktop, etc.).

## Install

```bash
npm install @spotterjs/mcp @spotterjs/core
```

Build from source (development):

```bash
npm run build -w @spotterjs/node
npm run build -w @spotterjs/core
npm run build -w @spotterjs/mcp
```

## Cursor / Claude configuration

```json
{
  "mcpServers": {
    "spotterjs": {
      "command": "npx",
      "args": ["-y", "@spotterjs/mcp"],
      "env": {
        "SPOTTERJS_WORKSPACE_ROOT": "C:/path/to/your/project",
        "SPOTTERJS_ALLOW_SHELL": "1",
        "SPOTTERJS_A11Y": "1"
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTTERJS_WORKSPACE_ROOT` | `process.cwd()` | Sandbox root for `host_*` file tools |
| `SPOTTERJS_ALLOW_SHELL` | `0` | Set to `1` to enable `host_exec` |
| `SPOTTERJS_FS_MAX_BYTES` | `1048576` | Max read/write size per file |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | `60000` | Shell command timeout |
| `SPOTTERJS_SHELL` | *(auto)* | Override shell executable |
| `SPOTTERJS_A11Y` | off | Set to `1` to register accessibility tools |
| `SPOTTERJS_ANDROID_ADB` | off | Set to `1` to register Android ADB tools |

### Shell platform policy

`host_exec` does **not** require you to pick a shell:

| OS | Shell | Example command |
|----|-------|-----------------|
| Windows | PowerShell | `Get-Location` |
| Linux / macOS | bash | `pwd` |

Use `host_shell_info` to query the active shell and syntax hint.

## Tools

### Desktop (`desktop_*`)

| Tool | Description |
|------|-------------|
| `desktop_list_windows` | Visible windows with PID / process name |
| `desktop_list_apps` | Apps aggregated by process |
| `desktop_get_active_window` | Foreground window |
| `desktop_capture_screen` | PNG base64 (optional region) |
| `desktop_capture_window` | Capture by window id |
| `desktop_capture_active` | Capture foreground window |
| `desktop_focus_window` | Focus window |
| `desktop_mouse_move` / `desktop_mouse_click` / `desktop_mouse_tap` | Mouse input |
| `desktop_keyboard_type` | Type text |
| `desktop_clipboard_get` / `desktop_clipboard_set` | Clipboard |
| `desktop_find_template` | Template match on screen |

`desktop_find_template` accepts either a template file path or encoded image bytes:

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "region": { "left": 100, "top": 50, "width": 800, "height": 600 },
  "scale": true,
  "all": true
}
```

For in-memory templates, use:

```json
{
  "image": { "base64": "<png/jpeg/webp base64>", "mimeType": "image/png" }
}
```

The response is JSON text shaped as:

```json
{
  "matches": [
    {
      "region": { "left": 100, "top": 50, "width": 32, "height": 16 },
      "center": { "x": 116, "y": 58 },
      "score": 0.97
    }
  ],
  "coordinateSpace": "screen"
}
```

With `SPOTTERJS_A11Y=1`:

| Tool | Description |
|------|-------------|
| `desktop_a11y_attach_window` | Attach UIA / AT-SPI tree (returns HWND candidates + diagnosis) |
| `desktop_a11y_find` | Find element |
| `desktop_a11y_invoke` | Invoke pattern |
| `desktop_a11y_tap_element` | Click element center |
| `desktop_a11y_dump_tree` | Dump accessibility tree (`treeView`: auto/raw/control/content) |
| `desktop_a11y_element_info` | Single element metadata (patterns, runtimeId, etc.) |

### Android (`android_*`)

Enable with `SPOTTERJS_ANDROID_ADB=1`. `adb` must be installed on `PATH` unless
the tool call provides `adbPath`. Connect phones to the ADB server first by USB
debugging authorization or Android 11+ wireless debugging. Use discovery tools
when you do not want to handle serials manually.

| Tool | Description |
|------|-------------|
| `android_discover_devices` | Devices currently visible from `adb devices -l` |
| `android_pair_tcp` | Run `adb pair host:pairPort code` |
| `android_connect_network` | Run `adb connect host:connectPort` |
| `android_connect_default` | Connect the only authorized discovered device |
| `android_connect_all` | Connect all authorized discovered devices |
| `android_capture_screen` | Capture device screen as PNG base64 |
| `android_tap` / `android_swipe` | Touch input |
| `android_type_text` | Type text through `adb shell input text` |
| `android_keyevent` / `android_back` / `android_home` | Android key events |
| `android_start_app` / `android_stop_app` | Start or force-stop packages |
| `android_dump_tree` | Dump Android UIAutomator element tree |
| `android_find_element` / `android_wait_for_element` | Query UIAutomator elements by text, resource id, class, content description, package, and element state |
| `android_tap_element` / `android_type_element` | Tap or type through a matched UIAutomator element |
| `android_shell` | Run a raw `adb shell` command |
| `android_get_display_info` | Get `wm size` / `wm density` display metadata |
| `android_wake` / `android_sleep` | Wake or sleep the device |
| `android_current_app` | Report the focused package/activity from `dumpsys window` |
| `android_clear_app` | Clear app data with `pm clear packageName` |
| `android_find_template` | Template match on a device screenshot |
| `android_batch_tap` / `android_batch_swipe` | Touch input on all authorized devices |
| `android_batch_capture` | Capture all authorized devices |

`android_find_template` accepts the same `{ "path": "..." }` or base64 image
input shape as `desktop_find_template`, and returns matches in
`android-device` coordinate space.

Element tools also return `android-device` coordinate space. Queries can use
`text`, `textContains`, `resourceId`, `resourceIdContains`, `className`,
`classNameContains`, `contentDescription`, `contentDescriptionContains`,
`packageName`, `clickable`, `enabled`, `checked`, `selected`, `scrollable`, and
`focusable`.

Wireless debugging uses two steps. Pair with the host, pairing port, and code
from "Pair device with pairing code"; then connect with the host and connection
port shown on the main Wireless debugging screen. The two ports are often
different.

For plugin-level examples, multi-device usage, and ADB troubleshooting, see
[Android ADB automation](./guides/android-adb.md).

### Host (`host_*`)

| Tool | Description |
|------|-------------|
| `host_read_file` | Read text file in workspace |
| `host_write_file` | Write text file in workspace |
| `host_list_dir` | List directory |
| `host_stat` | File metadata |
| `host_open_file` | Open with OS default app |
| `host_shell_info` | Current shell + syntax hint |
| `host_exec` | Run command (requires `SPOTTERJS_ALLOW_SHELL=1`) |

## Security

- File paths must resolve **inside** `SPOTTERJS_WORKSPACE_ROOT`.
- Writing to `.env`, `credentials.json`, etc. is blocked by default.
- Shell execution is **disabled** unless `SPOTTERJS_ALLOW_SHELL=1`.
- Desktop tools can control your mouse, keyboard, and windows — enable only on trusted machines.

## Smoke test

```bash
npm run smoke:desktop
```

## MCP Inspector (manual)

```bash
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

Verify: `host_shell_info`, `desktop_list_apps`, `host_read_file` (with workspace root set).
