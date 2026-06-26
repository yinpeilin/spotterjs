# spotterjs MCP Server (`@spotterjs/mcp`)

[中文文档](../zh-CN/MCP.md)

The spotterjs MCP server exposes desktop automation, optional Android companion
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
| `SPOTTERJS_ANDROID` | off | Set to `1` to register Android companion tools |

Use `host_shell_info` to check whether commands run through PowerShell, bash,
or a custom shell.

## Recommended Tool Flow

1. Discover the target with `desktop_list_windows`, `desktop_list_apps`, or Android discovery.
2. Capture with `desktop_capture_*` or use a desktop visual combo tool.
3. Inspect with OCR, template matching, or accessibility.
4. Act with tap, keyboard, accessibility invoke, or Android input.
5. Use host tools for workspace files only when the task needs local file I/O.

## Agent Recipes

Use the combo tools when an agent would otherwise capture, save, inspect, and
then act on the same desktop image. They keep one original in-memory capture for
the visual operation and still write a PNG artifact for review.

| Goal | Prefer | Why |
|------|--------|-----|
| Read all text from the current screen/window | `desktop_capture_and_ocr` without `text` | One capture, one artifact, OCR coordinates already in screen space |
| Find visible text before deciding the next action | `desktop_capture_and_ocr` with `text` | Returns `matches`; with `debugImage: true`, also returns scored `candidates` |
| Find an icon or button by image | `desktop_capture_and_find_template` | Avoids a separate capture call before matching |
| Click a visually stable target | `desktop_find_template_and_tap` | Captures, matches, and taps only after a successful match |
| Inspect a saved or externally provided image | `ocr_*` or lower-level `desktop_find_template` | Use the lower-level tools when the image already exists |

All desktop visual combo results return `coordinateSpace: "screen"`. `region`
only limits a `source: "screen"` capture. For `source: "active"` and
`source: "window"`, the full window is captured and result coordinates are
translated by the window origin. `source: "window"` requires `windowId`.

Combo tools default `detail` to `"original"` so artifact pixels line up with
returned coordinates. Pass `detail: "high"` only when the artifact is for
review and exact pixel correspondence is less important.

Debug images are also artifacts. They mark the same local pixels used by OCR or
template matching, while returned coordinates remain screen coordinates. This
is useful when an agent needs to explain why it tapped or why a text match was
rejected.

## Error Diagnostics

Tool failures still return MCP `isError: true` text responses for compatibility.
When the underlying library exposes structured diagnostics, the text includes a
stable `code`, a short serialized `context` summary, and `domain`:

```text
ocr_find_text failed: OCR text not found: Send (code=SPOTTER_OCR_TEXT_NOT_FOUND context={"text":"Send","exact":true} domain=ocr)
```

Use `code` and `domain` for retry and troubleshooting logic. Context values are
intentionally small, serializable, and should not contain large binary data or
sensitive file contents.

## Capture Artifacts

Capture tools return a workspace PNG file path, not inline base64. They accept
`detail: "high" | "original"`.

- `high` is the default and downscales long edges above 1600 pixels.
- `original` preserves full resolution for OCR, pixel inspection, and template debugging.
- Desktop visual combo tools default to `original`; standalone capture tools
  keep the historical `high` default.

```json
{
  "region": { "left": 0, "top": 0, "width": 1920, "height": 1080 },
  "detail": "original"
}
```

## Debug Image Artifacts

Desktop matching, OCR, and click tools can return annotated PNG artifacts when
called with `debugImage: true`. The debug image path is returned as
`debugImagePath` and points under `.spotter/artifacts`.

Debug images are opt-in. They preserve source dimensions so the returned
coordinates still line up with the marked pixels.

`score` keeps its existing meaning for each engine: backend-native score for
template matching (NCC correlation or feature inlier quality) and recognition
confidence for OCR. `matchScore` is the normalized score for the requested
match. For template matching, `matchScore` equals `score`; for OCR text
matching, it describes how closely a recognized line matches the query.

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
| `desktop_keyboard_type` / `desktop_keyboard_tap` | Type text or tap a named/number key |
| `desktop_clipboard_get` / `desktop_clipboard_set` | Clipboard text |
| `desktop_find_template` | Template match on the screen |
| `desktop_capture_and_ocr` | Capture once, write an artifact, and run OCR |
| `desktop_capture_and_find_template` | Capture once, write an artifact, and run template matching |
| `desktop_find_template_and_tap` | Capture once, template match, and tap the best match |

Template input can be a file path or encoded image bytes:

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "region": { "left": 100, "top": 50, "width": 800, "height": 600 },
  "scale": true,
  "all": true,
  "debugImage": true
}
```

Combo tools accept the same template image shape and return the capture
artifact alongside screen-space results:

```json
{
  "source": "window",
  "windowId": "123456",
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "debugImage": true
}
```

```json
{
  "imagePath": ".spotter/artifacts/desktop-capture-template-2026-06-02T00-00-00-000Z-abc123.png",
  "source": "window",
  "windowId": "123456",
  "origin": { "x": 100, "y": 200 },
  "coordinateSpace": "screen",
  "matches": [
    {
      "region": { "left": 140, "top": 220, "width": 32, "height": 16 },
      "center": { "x": 156, "y": 228 },
      "score": 0.97,
      "matchScore": 0.97,
      "matchAlgorithm": "ncc"
    }
  ],
  "debugImagePath": ".spotter/artifacts/desktop-capture-template-debug-2026-06-02T00-00-00-000Z-def456.png"
}
```

`desktop_find_template_and_tap` returns one `match`, the `tapPoint`, the capture
artifact, and optional `debugImagePath`. It does not tap if matching fails.

The response uses screen coordinates:

```json
{
  "matches": [
    {
      "region": { "left": 100, "top": 50, "width": 32, "height": 16 },
      "center": { "x": 116, "y": 58 },
      "score": 0.97,
      "matchScore": 0.97,
      "matchAlgorithm": "ncc"
    }
  ],
  "coordinateSpace": "screen",
  "debugImagePath": ".spotter/artifacts/desktop-find-template-debug-2026-06-02T00-00-00-000Z-abc123.png"
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
  "minSimilarity": 0.85,
  "modelProfile": "server",
  "debugImage": true
}
```

Use `origin` when the image is a crop and results need to be translated back to
another coordinate space.

`ocr_find_text` returns OCR matches with both recognition confidence and text
match diagnostics:

```json
{
  "imagePath": "test-output/mcp/capture.png",
  "matches": [
    {
      "text": "Send",
      "score": 0.95,
      "matchScore": 1,
      "matchAlgorithm": "ocr-text",
      "matchKind": "contains",
      "query": "Send",
      "matched": true,
      "region": { "left": 100, "top": 50, "width": 40, "height": 16 },
      "center": { "x": 120, "y": 58 }
    }
  ],
  "debugImagePath": ".spotter/artifacts/ocr-find-text-debug-2026-06-02T00-00-00-000Z-abc123.png"
}
```

When `debugImage: true`, the response also includes scored `candidates` for all
recognized OCR lines so no-match cases can be inspected without re-running OCR.

For live desktop OCR, prefer `desktop_capture_and_ocr` when the agent does not
need to reuse an existing artifact:

```json
{
  "source": "active",
  "text": "Send",
  "minSimilarity": 0.85,
  "modelProfile": "server",
  "debugImage": true
}
```

## Android Tools

Enable with `SPOTTERJS_ANDROID=1`. Pair with the Spotter mobile companion app
over WebSocket, then reuse the returned session token for later calls.

`android_connect` caches the connected phone in the MCP server and returns a
`deviceId` (`"default"` unless provided). Later Android tools accept either
`{ "deviceId": "default" }` or the legacy `{ "url": "...", "sessionToken": "..." }`
shape.

| Tool | Description |
|------|-------------|
| `android_connect` | Pair with a companion app or reuse a session token |
| `android_disconnect` | Close a cached companion session |
| `android_heartbeat` | Check the companion session |
| `android_status` | Fetch companion state |
| `android_display_info` | Get Android display size and density |
| `android_current_app` | Report the focused Android package/activity |
| `android_launch_app` | Launch an app by Android package name |
| `android_capture_screen` | Capture the Android screen as a workspace PNG artifact |
| `android_tap` / `android_swipe` / `android_gesture` | Touch input |
| `android_text` | Type text through the companion app |
| `android_keyevent` / `android_back` / `android_home` | Android key events |
| `android_dump_tree` | Dump Android accessibility tree |
| `android_find_element` / `android_wait_for_element` | Query accessibility elements |
| `android_tap_element` / `android_type_element` | Act on accessibility elements |
| `android_find_template` | Capture once and find image templates in Android device coordinates |
| `android_find_template_and_tap` | Capture once, match the best template, and tap its center |

Android element and template results use `android-device` coordinates.
Screen capture and template tools return workspace PNG artifacts rather than
inline image bytes. They use `detail: "original"` by default so artifact pixels
line up with returned Android coordinates; pass `detail: "high"` only for
smaller review images. Template input matches desktop tools: `{ "path": "..." }`
or `{ "base64": "...", "mimeType": "image/png" }`.

Android screen capture requires the user to grant the companion app's
MediaProjection prompt. On Android 14 and newer the app runs screen capture in
a `mediaProjection` foreground service as required by the platform.
`android_wait_for_element` uses `waitTimeoutMs` for UI element wait time;
it also accepts optional `pollMs` and `maxDepth`. `timeoutMs` remains reserved
for WebSocket request timeout.

Example loop:

```json
{ "url": "ws://192.168.1.23:17341", "code": "123456" }
```

```json
{ "deviceId": "default", "packageName": "com.android.settings" }
```

```json
{
  "deviceId": "default",
  "textContains": "Settings",
  "waitTimeoutMs": 5000,
  "pollMs": 250,
  "maxDepth": 8
}
```

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
