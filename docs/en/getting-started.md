# Getting Started

[中文文档](../zh-CN/getting-started.md)

This guide installs `@spotterjs/core`, runs a small desktop automation script,
and points you to the next guide for each capability.

## Requirements

- Node.js 18 or newer.
- Windows x64 (MSVC) or Linux x64 (glibc) for the prebuilt native package.
- A desktop session that allows capture and input.

## Install

```bash
npm install @spotterjs/core
```

From the repository:

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:ts
```

Build native packages only when working on Rust/N-API code:

```bash
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
npm run build:native
```

## First Script

Run this first to verify that `@spotterjs/core` loads and can read screen and
capture data.

Create `check-spotter.ts`:

```typescript
import { screen } from "@spotterjs/core";

const size = screen.size();
const capture = screen.capture({
  left: 0,
  top: 0,
  width: Math.min(200, size.width),
  height: Math.min(200, size.height),
});

console.log({
  screen: size,
  capture: {
    width: capture.width,
    height: capture.height,
    bytes: capture.data.length,
  },
});
```

Run it:

```bash
npx tsx check-spotter.ts
```

If you already have a visible button or icon screenshot, use template matching
next:

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

All high-level desktop match results use screen coordinates. Passing
`options.region` only limits the search area; it does not change the returned
coordinate space.

## Verify the Local Environment

```bash
npm run smoke:version
npm run smoke:capture
npm run smoke:match
```

Use `npm run smoke` for the full local smoke suite. Smoke scripts may control
the real desktop, so run them on a machine where that is safe.

## Choose an Entrypoint

| Need | Start with |
|------|------------|
| Screen capture or template matching | [`screen`](./guides/desktop-automation.md) |
| Window discovery and window-scoped matching | [`desktop` and `windows`](./guides/desktop-automation.md) |
| Semantic UI controls | [`accessibility`](./guides/accessibility.md) |
| Text in screenshots | [`@spotterjs/plugin-ocr`](./guides/ocr.md) |
| Android devices | [`@spotterjs/plugin-android-adb`](./guides/android-adb.md) |
| Code-agent tools | [`@spotterjs/mcp`](./MCP.md) |

## Next Steps

- Build a desktop script: [Desktop automation](./guides/desktop-automation.md).
- Match visual templates: [Template matching](./MATCHING.md).
- Connect an MCP client: [MCP server](./MCP.md).
- Debug common setup issues: [Troubleshooting](./troubleshooting.md).
