# spotterjs

[中文文档](./README.zh-CN.md)

spotterjs is a TypeScript-first desktop automation toolkit backed by Rust native
addons. It provides screen capture, mouse and keyboard input, window discovery,
accessibility automation, NCC template matching, OCR, Android companion automation,
and a CLI with a bundled Skill for code agents.

- Source: [GitHub repository](https://github.com/yinpeilin/spotterjs)
- npm packages: `@spotterjs/core` and optional plugins
- Documentation: [English](./docs/en/README.md) / [中文](./docs/zh-CN/README.md)

## Install

```bash
npm install @spotterjs/core
```

Prebuilt native packages currently target:

- Windows x64 (MSVC)
- Linux x64 (glibc)

## Quick Start

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

After that works, use template matching to click a visible button or icon:

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.findTemplate("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

`screen.findTemplate` accepts either an image path or an encoded PNG/JPEG/WebP `Buffer`.
Match results use screen coordinates.

## CLI + Skill for agents

The former `@spotterjs/mcp` package is retired. Agent integrations now use
`@spotterjs/cli` and its bundled Skill. Remove the old MCP server entry from your
agent configuration when migrating.

Build the source checkout and discover commands:

```bash
npm ci
npm run build:native
npm run build:ts
node packages/cli/dist/cli.js list
node packages/cli/dist/cli.js run desktop_list_windows
```

Install the bundled Skill into an agent skills directory with
`node packages/cli/dist/cli.js skill install --target <skills-directory>`.
For published releases, use `npx @spotterjs/cli` or install `@spotterjs/cli` globally.
See [CLI + Skill](./docs/en/CLI.md) for JSON parameters and safe text input.

## Packages

| Package | Required | Purpose |
|---------|----------|---------|
| `@spotterjs/core` | Yes | Screen, mouse, keyboard, windows, accessibility, host I/O, and template matching |
| `@spotterjs/base` | Transitive | Shared TypeScript types |
| `@spotterjs/node` | Transitive | Native loader for capture, input, windows, accessibility, image, and NCC matching |
| `@spotterjs/node-win32-x64-msvc` | Optional | Windows x64 native binary |
| `@spotterjs/node-linux-x64-gnu` | Optional | Linux x64 glibc native binary |
| `@spotterjs/cli` | Optional | JSON CLI and agent Skill for desktop, Android, OCR, and workspace commands |
| `@spotterjs/plugin-android` | Optional | Android automation through the mobile companion app |
| `@spotterjs/plugin-ocr` | Optional | OCR with ONNX Runtime |

## Documentation Map

- [Getting started](./docs/en/getting-started.md): installation, first script, and local verification.
- [Desktop automation](./docs/en/guides/desktop-automation.md): windows, capture, input, clipboard, and coordinates.
- [Template matching](./docs/en/MATCHING.md): NCC options, encoded buffers, regions, and performance.
- [Accessibility automation](./docs/en/guides/accessibility.md): UIA / AT-SPI trees, queries, and diagnostics.
- [CLI + Skill](./docs/en/CLI.md): command discovery, JSON input/output, sequences, and agent Skill installation.
- [Android companion](./docs/en/guides/android-companion.md): WebSocket pairing, session reuse, device input, and accessibility tree API.
- [Mobile companion app](./docs/en/guides/mobile-companion.md): Flutter setup, checks, APK builds, and release notes.
- [OCR plugin](./docs/en/guides/ocr.md): model cache, download sources, local models, coordinates, and testing.
- [Examples](./docs/en/examples.md): Paint examples, smoke scripts, integration scripts, and benchmarks.
- [Troubleshooting](./docs/en/troubleshooting.md): native loading, matching, Android companion, OCR, and CLI issues.

Maintainer docs:

- [Architecture](./docs/en/development/architecture.md)
- [Testing](./docs/en/development/testing.md)
- [Publishing](./docs/en/PUBLISHING.md)
- [Documentation style](./docs/en/development/documentation-style.md)
- [Cleanup and architecture notes](./docs/en/CLEANUP-AND-ARCHITECTURE.md)

## Local Development

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:native
npm run build:ts
npm test
```

A fresh source checkout needs a native build before `build:ts`: the workspace
loader and TypeScript declarations are generated and are not committed. Install
the Rust toolchain from `rust-toolchain.toml` and the platform build tools first.
On Linux x64, replace `npm run build:native` above with
`npm run build:linux -w @spotterjs/node` to enable X11 support.
After the initial native build, TypeScript-only changes can use `npm run build:ts`.
See [source setup](./docs/en/getting-started.md#source-checkout) for prerequisites.

## License

**spotterjs License 1.0**. See [LICENSE](./LICENSE) and
[中文说明](./LICENSE.zh-CN).

- Free: personal learning, teaching, non-commercial research, and local evaluation.
- Commercial: products, SaaS, paid delivery, enterprise production, and similar use
  require authorization. Contact `ypl123698745@qq.com` or open a GitHub issue.
