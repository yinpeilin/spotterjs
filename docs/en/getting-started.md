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

## Source Checkout

Installing the published package does not require Rust. A fresh source checkout
does: `@spotterjs/node` is linked to the local workspace, whose `index.js`,
`index.d.ts`, and native binary are generated rather than committed. Installing
the optional platform package alone does not generate these files.

Install Rust with the version selected by `rust-toolchain.toml`. Windows builds
also need the MSVC C++ build tools and Windows SDK. Linux x64 builds need a
C/C++ toolchain and X11 development libraries. Desktop automation requires an
X11 session.

On Windows x64:

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:native
npm run build:ts
```

On Linux x64, use this native build command instead to enable X11 support:

```bash
npm run build:linux -w @spotterjs/node
```

Then run `npm run build:ts`. After the first native build, TypeScript-only
changes can use `npm run build:ts` directly. Rebuild native code when changing
Rust/N-API code. `TS2307` for `@spotterjs/node` on a fresh checkout means the
generated declarations are missing; run the platform's native build first.

## First Script

Run this first to verify that `@spotterjs/core` loads and can read screen and
capture data.

Create `check-spotter.ts`:

```typescript
import { screen } from "@spotterjs/core";

const size = screen.getSize();
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

const match = await screen.findTemplate("./button.png", {
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
| Android devices | [`@spotterjs/plugin-android`](./guides/android-companion.md) |
| Code-agent tools | [`@spotterjs/cli`](./CLI.md) |

## Next Steps

- Build a desktop script: [Desktop automation](./guides/desktop-automation.md).
- Match visual templates: [Template matching](./MATCHING.md).
- Automate from an agent shell: [CLI + Skill](./CLI.md).
- Debug common setup issues: [Troubleshooting](./troubleshooting.md).
