# spotterjs MCP Server (`@spotterjs/mcp`)

[中文文档](../zh-CN/MCP.md)

The spotterjs MCP server exposes desktop automation, optional Android ADB
automation, OCR, workspace file I/O, and controlled shell execution to MCP
clients such as Cursor and Claude Desktop.

## Install

```bash
npm install @spotterjs/mcp @spotterjs/core
```

Development build:

```bash
npm run build -w @spotterjs/node
npm run build -w @spotterjs/core
npm run build -w @spotterjs/mcp
```

## Cursor / Claude Configuration

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

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTTERJS_WORKSPACE_ROOT` | `process.cwd()` | Sandbox root for `host_*` file tools |
| `SPOTTERJS_ALLOW_SHELL` | `0` | Set to `1` to enable `host_exec` |
| `SPOTTERJS_FS_MAX_BYTES` | `1048576` | Max bytes per file read/write and command stream |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | `60000` | Shell command timeout |
| `SPOTTERJS_SHELL` | auto | Override shell executable |
| `SPOTTERJS_A11Y` | off | Set to `1` to register accessibility tools |
| `SPOTTERJS_ANDROID_ADB` | off | Set to `1` to register Android ADB tools |

Use `host_shell_info` to check whether commands run through PowerShell, bash,
or a custom shell.

## Recommended Tool Flow

1. Discover the target with `desktop_list_windows`, `desktop_list_apps`, or Android discovery.
2. Capture with `desktop_capture_*` or `android_capture_screen`.
3. Inspect with OCR, template matching, or accessibility.
4. Act with tap, keyboard, accessibility invoke, or Android input.
5. Use host tools for workspace files only when the task needs local file I/O.

## Error Diagnostics

Tool failures still return MCP `isError: true` text responses for compatibility.
When the underlying library exposes structured diagnostics, the text includes a
stable `code` and a short serialized `context` summary:

```text
ocr_find_text failed: OCR text not found: Send (code=OCR_TEXT_NOT_FOUND context={"text":"Send","exact":true})
```

Use `code` for retry and troubleshooting logic. Context values are intentionally
small, serializable, and should not contain large binary data or sensitive file
contents.

## Capture Artifacts

Capture tools return a workspace PNG file path, not inline base64. They accept
`detail: "high" | "original"`.

- `high` is the default and downscales long edges above 1600 pixels.
- `original` preserves full resolution for OCR, pixel inspection, and template debugging.

```json
{
  "region": { "left": 0, "top": 0, "width": 1920, "height": 1080 },
  "detail": "original"
}
```

## Desktop Tools

| Tool | Description |
|------|-------------|
| `desktop_list_windows` | List visible top-level windows with process metadata |
| `desktop_list_apps` | List desktop applications grouped by process |
| `desktop_get_active_window` | Return the foreground window |
| `desktop_capture_screen` | Capture the screen or a region as a workspace PNG |
| `desktop_capture_window` | Capture a window by ID as a workspace PNG |
| `desktop_capture_active` | Capture the foreground window as a workspace PNG |
| `desktop_focus_window` | Bring a window to the foreground |
| `desktop_mouse_move` / `desktop_mouse_click` / `desktop_mouse_tap` | Mouse input |
| `desktop_keyboard_type` | Type text |
| `desktop_clipboard_get` / `desktop_clipboard_set` | Clipboard text |
| `desktop_find_template` | Template match on the screen |

Template input can be a file path or encoded image bytes:

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "region": { "left": 100, "top": 50, "width": 800, "height": 600 },
  "scale": true,
  "all": true
}
```

The response uses screen coordinates:

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

## Accessibility Tools

Enable with `SPOTTERJS_A11Y=1`.

| Tool | Description |
|------|-------------|
| `desktop_a11y_attach_window` | Attach a UIA / AT-SPI tree and return diagnostics |
| `desktop_a11y_find` | Find an element by name, type, or automation ID |
| `desktop_a11y_invoke` | Invoke an element pattern |
| `desktop_a11y_tap_element` | Tap an element center |
| `desktop_a11y_dump_tree` | Dump an accessibility tree |
| `desktop_a11y_element_info` | Return metadata for one element |

Use accessibility when control names or automation IDs are stable. Use template
matching when the target is visually stable but not semantically exposed.

## OCR Tools

| Tool | Description |
|------|-------------|
| `ocr_read_image` | Read text lines from a workspace image path |
| `ocr_find_text` | Find matching text lines in a workspace image path |

Typical flow:

```json
{
  "imagePath": "test-output/mcp/capture.png",
  "text": "Send",
  "exact": false,
  "modelProfile": "server"
}
```

Use `origin` when the image is a crop and results need to be translated back to
another coordinate space.

## Android Tools

Enable with `SPOTTERJS_ANDROID_ADB=1`. ADB must be on `PATH`, configured with
`SPOTTERJS_ADB_PATH`, or provided by the tool call.

| Tool | Description |
|------|-------------|
| `android_discover_devices` | List devices from `adb devices -l` |
| `android_pair_tcp` | Pair an Android 11+ wireless debugging device |
| `android_connect_network` | Connect to a wireless debugging endpoint |
| `android_connect_default` | Connect the only authorized discovered device |
| `android_connect_all` | Connect all authorized discovered devices |
| `android_capture_screen` | Capture a device screen as a workspace PNG |
| `android_tap` / `android_swipe` | Touch input |
| `android_type_text` | Type text through `adb shell input text` |
| `android_keyevent` / `android_back` / `android_home` | Android key events |
| `android_start_app` / `android_stop_app` | Start or stop packages |
| `android_dump_tree` | Dump UIAutomator tree |
| `android_find_element` / `android_wait_for_element` | Query UIAutomator elements |
| `android_tap_element` / `android_type_element` | Act on UIAutomator elements |
| `android_shell` | Run a raw `adb shell` command |
| `android_find_template` | Template match on a device screenshot |
| `android_batch_tap` / `android_batch_swipe` / `android_batch_capture` | Multi-device helpers |

Android element and template results use `android-device` coordinates.
`android_wait_for_element` uses `waitTimeoutMs` for UI element wait time;
`timeoutMs` remains reserved for ADB command timeout.

## Host Tools

| Tool | Description |
|------|-------------|
| `host_read_file` | Read a text file inside the workspace |
| `host_write_file` | Write a text file inside the workspace |
| `host_list_dir` | List directory entries |
| `host_stat` | Return file metadata |
| `host_open_file` | Open a file or directory with the OS default app |
| `host_shell_info` | Return shell executable and syntax hint |
| `host_exec` | Run a shell command when enabled |

## Security

- File paths must resolve inside `SPOTTERJS_WORKSPACE_ROOT`.
- Writes to `.env`, `credentials.json`, and similar sensitive files are blocked by default.
- Shell execution is disabled unless `SPOTTERJS_ALLOW_SHELL=1`.
- Desktop and Android tools can control real devices; enable them only on trusted machines.

## Manual Verification

```bash
npm run smoke:desktop
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

Verify `host_shell_info`, `desktop_list_apps`, and `host_read_file` with a
workspace root configured.
