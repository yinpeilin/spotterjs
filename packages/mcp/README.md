# @spotterjs/mcp

[中文文档](../../docs/zh-CN/MCP.md)

spotterjs MCP server exposes desktop automation, optional Android companion
automation, OCR, workspace file I/O, and optional shell execution to MCP
clients.

## Install

```bash
npm install @spotterjs/mcp @spotterjs/core
```

Development build:

```bash
npm run build -w @spotterjs/mcp
npx spotterjs-mcp
```

## Minimal Configuration

```json
{
  "mcpServers": {
    "spotterjs": {
      "command": "npx",
      "args": ["-y", "@spotterjs/mcp"],
      "env": {
        "SPOTTERJS_WORKSPACE_ROOT": "C:/path/to/your/project"
      }
    }
  }
}
```

Enable shell, Android, or accessibility tools explicitly:

```json
{
  "SPOTTERJS_ALLOW_SHELL": "1",
  "SPOTTERJS_ANDROID": "1",
  "SPOTTERJS_A11Y": "1"
}
```

Full configuration, tool lists, response shapes, and security policy are
documented in [docs/en/MCP.md](../../docs/en/MCP.md).

Chinese docs: [docs/zh-CN/MCP.md](../../docs/zh-CN/MCP.md).

## Agent Workflows

For live desktop vision, prefer the combo tools when the agent would otherwise
capture and immediately inspect the same image:

| Tool | Use it for |
|------|------------|
| `desktop_capture_and_ocr` | Capture `screen`, `active`, or `window`, write an artifact, then OCR the same original capture |
| `desktop_capture_and_find_template` | Capture once and run template matching on that exact capture |
| `desktop_find_template_and_tap` | Capture once, find the best template, and tap the match center only on success |

Minimal OCR call:

```json
{
  "source": "active",
  "text": "Send",
  "modelProfile": "server",
  "debugImage": true
}
```

Minimal template-and-tap call:

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "debugImage": true
}
```

Combo tools default `source` to `"screen"` and `detail` to `"original"`.
`source: "window"` requires `windowId`. All desktop visual results return
`coordinateSpace: "screen"` and a workspace `imagePath` under
`.spotter/artifacts`.

Lower-level `desktop_capture_*`, `ocr_*`, and `desktop_find_template` tools
remain available when an artifact already exists or the agent needs manual
control over each step.

Desktop OCR, template matching, mouse click/tap, and accessibility tap tools
also support opt-in `debugImage: true` responses. These return annotated
workspace PNGs plus normalized `matchScore` diagnostics for matching results.

Android companion tools cache `android_connect` sessions by `deviceId` (default:
`"default"`), so follow-up tools can use the short `{ "deviceId": "default" }`
shape after pairing. The legacy `{ "url": "...", "sessionToken": "..." }`
shape remains supported for one-shot calls.

Android visual tools mirror the desktop artifact flow: `android_capture_screen`
writes a PNG under `.spotter/artifacts`, `android_find_template` matches on the
same captured frame, and `android_find_template_and_tap` taps only after a
successful match. Results use `coordinateSpace: "android-device"`.

## Safety Notes

- Desktop and Android tools operate on real devices. Use them only on trusted
  machines and prefer read-only discovery before input actions.
- Shell execution is disabled unless `SPOTTERJS_ALLOW_SHELL=1`.
- File tools are scoped to `SPOTTERJS_WORKSPACE_ROOT`.
- `desktop_find_template_and_tap` does not click when matching fails; keep
  confidence thresholds high enough for destructive workflows.
