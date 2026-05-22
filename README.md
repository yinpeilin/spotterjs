# spotterjs

Cross-platform desktop automation with a **TypeScript-first** API, Rust native addons, and **built-in NCC template matching** (multi-scale, path/Buffer needles).

- **Source:** [Gitee — spotterjs/spotterjs](https://gitee.com/ypl0lpy/spotterjs)
- **npm:** `@spotterjs/core` and related packages (see [Packages](#packages))

## Packages

| npm package | Required | Role |
|-------------|----------|------|
| `@spotterjs/core` | Yes (entry) | Screen, mouse, keyboard, windows, accessibility |
| `@spotterjs/base` | Transitive | Shared TS types |
| `@spotterjs/node` | Transitive | Native loader: capture, input, window, NCC template match |
| `@spotterjs/node-win32-x64-msvc` | Optional | Windows x64 native binary |
| `@spotterjs/node-linux-x64-gnu` | Optional | Linux x64 glibc native binary |
| `@spotterjs/plugin-ocr` | Optional | **Preview** — OCR placeholder only |
| `@spotterjs/mcp` | Optional | MCP server — desktop + workspace file + shell tools |

## Install (users)

```bash
npm install @spotterjs/core
```

Supported native platforms (prebuilt on publish): **Windows x64 (MSVC)**, **Linux x64 (gnu)**.

## Install (development)

```bash
git clone https://gitee.com/ypl0lpy/spotterjs.git
cd spotterjs
npm ci

# Rust
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
cargo build -p spotterjs-node

# Node native (Windows: MSVC + link.exe required)
cd crates/spotterjs-node && npm install && npm run build
cd ../..

npm run build:ts
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/PUBLISHING.md](docs/PUBLISHING.md) for maintainers.

## Architecture

```
@spotterjs/core (TS)          ← primary entry
    ├── @spotterjs/base (TS types)
    └── @spotterjs/node (native: input, capture, window, NCC match)

spotterjs-base (Rust)         ← shared Region, MatchOptions, N-API types
spotterjs-core (Rust)         ← platform + capture + input
spotterjs-plugin-match-ncc    ← NCC matcher (multi-scale, parallel)
```

All template matching goes through `@spotterjs/node` — there is no separate vision plugin package.

## Usage

```typescript
import { screen, mouse } from "@spotterjs/core";
import { centerOf } from "@spotterjs/base";

// NCC template match (path or PNG/JPEG Buffer needle)
const region = await screen.find("./button.png", {
  confidence: 0.9,
  multiScale: true,
});
const { x, y } = centerOf(region);
mouse.move(x, y);
mouse.click("left");

// In-memory needle (image file bytes)
import fs from "fs";
await screen.find(fs.readFileSync("./icon.png"), { confidence: 0.85 });

// findAll with search region (screen coordinates)
await screen.findAll("./icon.png", {
  confidence: 0.9,
  searchRegion: { left: 100, top: 50, width: 800, height: 600 },
});

// Keyboard text and shortcuts
import { keyboard } from "@spotterjs/core";
keyboard.write("hello");
keyboard.hotkey(["Ctrl", "V"]);
```

See [docs/MATCHING.md](docs/MATCHING.md) for match options and buffer APIs.

### MCP server

See [docs/MCP.md](docs/MCP.md) for `@spotterjs/mcp` setup (desktop tools, workspace files, PowerShell/bash).

### Accessibility (UIA / AT-SPI)

```typescript
import { accessibility, windowApi } from "@spotterjs/core";

accessibility.quick.enable();
const win = windowApi.getActive();
const root = accessibility.quick.attach(win.id);
const el = accessibility.quick.find(root, { controlType: "Button", name: "OK" });
accessibility.quick.invoke(el);
```

Windows uses UI Automation; Linux uses AT-SPI2 (`accessibility-linux` feature). Start with `accessibility.quick`; when an element cannot be found, use `accessibility.debug.dumpTree()` and the diagnostics APIs. See [scripts/README.md](scripts/README.md) for WeChat integration scripts.

## nut.js mapping

| nut.js | spotterjs |
|--------|---------|
| `@nut-tree/nut-js` | `@spotterjs/core` |
| `@nut-tree/nl-matcher` | Built-in NCC (`multiScale`, Buffer needles) |
| `screen.find` / `findAll` / `waitFor` | `screen.find` / `findAll` / `waitFor` |

## Benchmark (NCC multi-scale)

After smoke capture writes fixtures under `test-output/`:

```bash
npm run benchmark:ncc
```

## Testing

```bash
npm install
npm test
```

Rust only: `npm run test:rust`

Platform integration tests (not in default `npm test`): `npm run test:rust:ignored`

Linux X11: `cargo test -p spotterjs-core --features linux-x11`

### Smoke scripts (local desktop)

```bash
npm run smoke
```

See [scripts/README.md](scripts/README.md).

## License

**spotterjs License 1.0** — see [LICENSE](LICENSE) ([中文参考](LICENSE.zh-CN)).

- **Free:** personal learning, teaching, non-commercial research, and local evaluation.
- **Commercial use** (products, SaaS, paid delivery, enterprise production, etc.): contact **ypl123698745@qq.com** or [Gitee Issues](https://gitee.com/ypl0lpy/spotterjs/issues) for authorization before use.

Maintainers: [docs/PUBLISHING.md](docs/PUBLISHING.md)
