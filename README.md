# Spotter

Cross-platform desktop automation with a **TypeScript-first** API, Rust native addons, and **built-in NCC template matching** (multi-scale, path/Buffer needles).

- **Source:** [Gitee — spotter/spotter](https://gitee.com/ypl0lpy/spotter)
- **npm:** `@spotter/core` and related packages (see [Packages](#packages))

## Packages

| npm package | Required | Role |
|-------------|----------|------|
| `@spotter/core` | Yes (entry) | Screen, mouse, keyboard, windows, accessibility |
| `@spotter/base` | Transitive | Shared TS types |
| `@spotter-rs/node` | Transitive | Native: capture, input, window, NCC template match |
| `@spotter/plugin-ocr` | Optional | **Preview** — OCR placeholder only |
| `@spotter/mcp` | Optional | MCP server — desktop + workspace file + shell tools |

## Install (users)

```bash
npm install @spotter/core
```

Supported native platforms (prebuilt on publish): **Windows x64 (MSVC)**, **Linux x64 (gnu)**.

## Install (development)

```bash
git clone https://gitee.com/ypl0lpy/spotter.git
cd spotter
npm ci

# Rust
cargo build -p spotter-base -p spotter-core -p spotter-plugin-match-ncc
cargo build -p spotter-node

# Node native (Windows: MSVC + link.exe required)
cd crates/spotter-node && npm install && npm run build
cd ../..

npm run build:ts
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/PUBLISHING.md](docs/PUBLISHING.md) for maintainers.

## Architecture

```
@spotter/core (TS)          ← primary entry
    ├── @spotter/base (TS types)
    └── @spotter-rs/node (native: input, capture, window, NCC match)

spotter-base (Rust)         ← shared Region, MatchOptions, N-API types
spotter-core (Rust)         ← platform + capture + input
spotter-plugin-match-ncc    ← NCC matcher (multi-scale, parallel)
```

All template matching goes through `@spotter-rs/node` — there is no separate vision plugin package.

## Usage

```typescript
import { screen, mouse } from "@spotter/core";
import { centerOf } from "@spotter/base";

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
```

See [docs/MATCHING.md](docs/MATCHING.md) for match options and buffer APIs.

### MCP server

See [docs/MCP.md](docs/MCP.md) for `@spotter/mcp` setup (desktop tools, workspace files, PowerShell/bash).

### Accessibility (UIA / AT-SPI)

```typescript
import { accessibility, windowApi } from "@spotter/core";

accessibility.enable();
const win = windowApi.getActive();
const root = accessibility.attachWindow(win.id);
const el = accessibility.find(root, { controlType: "Button", name: "OK" });
accessibility.invoke(el);
```

Windows uses UI Automation; Linux uses AT-SPI2 (`accessibility-linux` feature). See [scripts/README.md](scripts/README.md) for WeChat integration scripts.

## nut.js mapping

| nut.js | Spotter |
|--------|---------|
| `@nut-tree/nut-js` | `@spotter/core` |
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

Linux X11: `cargo test -p spotter-core --features linux-x11`

### Smoke scripts (local desktop)

```bash
npm run smoke
```

See [scripts/README.md](scripts/README.md).

## License

**Spotter License 1.0** — see [LICENSE](LICENSE) ([中文参考](LICENSE.zh-CN)).

- **Free:** personal learning, teaching, non-commercial research, and local evaluation.
- **Commercial use** (products, SaaS, paid delivery, enterprise production, etc.): contact **ypl123698745@qq.com** or [Gitee Issues](https://gitee.com/ypl0lpy/spotter/issues) for authorization before use.

Maintainers: [docs/PUBLISHING.md](docs/PUBLISHING.md)
