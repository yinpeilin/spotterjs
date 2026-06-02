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

Desktop OCR, template matching, mouse click/tap, and accessibility tap tools
also support opt-in `debugImage: true` responses. These return annotated
workspace PNGs plus normalized `matchScore` diagnostics for matching results.

Android companion tools cache `android_connect` sessions by `deviceId` (default:
`"default"`), so follow-up tools can use the short `{ "deviceId": "default" }`
shape after pairing. The legacy `{ "url": "...", "sessionToken": "..." }`
shape remains supported for one-shot calls.
