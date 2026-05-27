# @spotterjs/core

[中文文档](../../README.zh-CN.md)

Main TypeScript entrypoint for spotterjs desktop automation. It provides screen
capture, template matching, mouse and keyboard input, window discovery,
accessibility automation, clipboard access, PNG encoding, coordinate helpers,
and sandboxed host I/O for agent workflows.

## Install

```bash
npm install @spotterjs/core
```

The package loads a matching `@spotterjs/node` native binary. Current prebuilt
targets are Windows x64 (MSVC) and Linux x64 (glibc).

## Quick Start

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

After that works, use template matching to click a visible button or icon:

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./assets/button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

Window-scoped matching:

```typescript
import { desktop, windows } from "@spotterjs/core";

const win = desktop.waitForWindow("Notepad", 10_000);
windows.tapTemplate(win.id, "./assets/save-btn.png", { confidence: 0.9 });
```

## Modules

| Export | Purpose |
|--------|---------|
| `screen` | Screen size, capture, full-screen NCC matching, `find`, `findAll`, `waitFor`, and `tap` |
| `windows` | List, focus, move, resize, capture, and window-scoped template matching |
| `mouse` / `keyboard` / `clipboard` | Input simulation and clipboard text |
| `desktop` | List apps by process, find windows by title, and wait for windows |
| `accessibility` | UIA / AT-SPI quick actions and diagnostics |
| `host` | Sandboxed workspace file I/O and optional shell execution for agent scenarios |
| `encodePng` / `encodePngBase64` | Encode `CaptureImage` to PNG bytes or base64 |
| `toMatchBox` / `matchTapScreen` | Coordinate conversion helpers |
| `image` | Match templates against an existing raw RGBA capture; decode encoded image buffers |
| `@spotterjs/core/native` | Unstable low-level N-API escape hatch |

Public APIs include English TSDoc in the generated declarations, so IDE hover
text explains parameters, coordinate spaces, errors, and side effects.

## Documentation

- [Getting started](../../docs/en/getting-started.md)
- [Desktop automation](../../docs/en/guides/desktop-automation.md)
- [Template matching](../../docs/en/MATCHING.md)
- [Accessibility automation](../../docs/en/guides/accessibility.md)
- [Troubleshooting](../../docs/en/troubleshooting.md)
- [中文文档](../../docs/zh-CN/README.md)

## License

Learning and non-commercial use are free. Commercial use requires
authorization. See [LICENSE](../../LICENSE).
