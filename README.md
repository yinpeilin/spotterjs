# spotterjs

[中文文档](./README.zh-CN.md)

spotterjs is a TypeScript-first desktop automation toolkit backed by Rust native
addons. It provides screen capture, mouse and keyboard input, window discovery,
accessibility automation, NCC template matching, OCR, Android ADB automation,
and an MCP server for code agents.

- Source: [GitHub / Gitee repository](https://gitee.com/ypl0lpy/spotterjs)
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

```typescript
import { keyboard, mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
keyboard.write("hello from spotterjs");
```

`screen.find` accepts either an image path or an encoded PNG/JPEG/WebP `Buffer`.
Match results use screen coordinates.

## Packages

| Package | Required | Purpose |
|---------|----------|---------|
| `@spotterjs/core` | Yes | Screen, mouse, keyboard, windows, accessibility, host I/O, and template matching |
| `@spotterjs/base` | Transitive | Shared TypeScript types |
| `@spotterjs/node` | Transitive | Native loader for capture, input, windows, accessibility, image, and NCC matching |
| `@spotterjs/node-win32-x64-msvc` | Optional | Windows x64 native binary |
| `@spotterjs/node-linux-x64-gnu` | Optional | Linux x64 glibc native binary |
| `@spotterjs/mcp` | Optional | MCP server for desktop, Android, OCR, and workspace tools |
| `@spotterjs/plugin-android-adb` | Optional | Android automation through ADB |
| `@spotterjs/plugin-ocr` | Optional | OCR with ONNX Runtime |

## Documentation Map

- [Getting started](./docs/en/getting-started.md): installation, first script, and local verification.
- [Desktop automation](./docs/en/guides/desktop-automation.md): windows, capture, input, clipboard, and coordinates.
- [Template matching](./docs/en/MATCHING.md): NCC options, encoded buffers, regions, and performance.
- [Accessibility automation](./docs/en/guides/accessibility.md): UIA / AT-SPI trees, queries, and diagnostics.
- [MCP server](./docs/en/MCP.md): client configuration, tools, response shapes, and security policy.
- [Android ADB](./docs/en/guides/android-adb.md): USB, wireless debugging, multi-device flows, and plugin API.
- [OCR plugin](./docs/en/guides/ocr.md): model cache, download sources, local models, coordinates, and testing.
- [Examples](./docs/en/examples.md): Paint examples, smoke scripts, integration scripts, and benchmarks.
- [Troubleshooting](./docs/en/troubleshooting.md): native loading, matching, ADB, OCR, and MCP issues.

Maintainer docs:

- [Architecture](./docs/en/development/architecture.md)
- [Testing](./docs/en/development/testing.md)
- [Publishing](./docs/en/PUBLISHING.md)
- [Documentation style](./docs/en/development/documentation-style.md)
- [Cleanup and architecture notes](./docs/en/CLEANUP-AND-ARCHITECTURE.md)

## Local Development

```bash
git clone https://gitee.com/ypl0lpy/spotterjs.git
cd spotterjs
npm ci
npm run build:ts
npm test
```

Build native packages when working on Rust or N-API code:

```bash
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
npm run build:native
```

## License

**spotterjs License 1.0**. See [LICENSE](./LICENSE) and
[中文说明](./LICENSE.zh-CN).

- Free: personal learning, teaching, non-commercial research, and local evaluation.
- Commercial: products, SaaS, paid delivery, enterprise production, and similar use
  require authorization. Contact `ypl123698745@qq.com` or open a Gitee issue.
