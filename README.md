# Spotter

Cross-platform desktop automation with a **TypeScript-first** API, Rust native addons, and pluggable vision backends.

- **Source:** [Gitee — spotter/spotter](https://gitee.com/ypl0lpy/spotter)
- **npm:** `@spotter/core` and related packages (see [Packages](#packages))

## Packages

| npm package | Required | Role |
|-------------|----------|------|
| `@spotter/core` | Yes (entry) | Screen, mouse, keyboard, windows, accessibility |
| `@spotter/base` | Transitive | Shared TS types |
| `@spotter-rs/node` | Transitive | Native: capture, input, window, NCC match |
| `@spotter/plugin-match-opencv` | Optional | OpenCV template matching plugin |
| `@spotter-rs/node-match-opencv` | Optional | Native OpenCV matcher |
| `@spotter/plugin-ocr` | Optional | **Preview** — OCR placeholder only |

## Install (users)

```bash
npm install @spotter/core
```

Optional OpenCV plugin:

```bash
npm install @spotter/plugin-match-opencv @spotter-rs/node-match-opencv
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

### OpenCV addon (optional)

See [crates/spotter-node-match-opencv/README.md](crates/spotter-node-match-opencv/README.md) for vcpkg / apt setup.

```bash
cd crates/spotter-node-match-opencv && npm install && npm run build
npm run build -w @spotter/plugin-match-opencv
```

## Architecture

```
@spotter/core (TS)          ← primary entry
    ├── @spotter/base (TS types)
    ├── @spotter-rs/node (native: input, capture, window, NCC match)
    └── @spotter/plugin-match-opencv (optional)
            └── @spotter-rs/node-match-opencv (native: OpenCV match only)

spotter-base (Rust)         ← shared Region, MatchOptions, N-API types
spotter-core (Rust)         ← platform + capture + input
spotter-plugin-match-ncc    ← default matcher
spotter-plugin-match-opencv ← OpenCV matcher (optional build)
```

**Two independent native npm packages** share `spotter-base` — OpenCV is **not** a feature on `@spotter-rs/node`.

## Usage

```typescript
import { screen, mouse, useMatchPlugin } from "@spotter/core";
import { useOpencvMatcher } from "@spotter/plugin-match-opencv";
import { centerOf } from "@spotter/base";

// Default: NCC via @spotter-rs/node
const region = await screen.find("./button.png", { confidence: 0.9 });
const { x, y } = centerOf(region);
mouse.move(x, y);
mouse.click("left");

// Optional: switch to OpenCV (requires @spotter-rs/node-match-opencv built)
useOpencvMatcher({ multiScale: true });
await screen.find("./button.png", { confidence: 0.9, multiScale: true });
```

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
| `@nut-tree/nl-matcher` | `@spotter/plugin-match-opencv` + `@spotter-rs/node-match-opencv` |
| `useNlMatcher()` | `useOpencvMatcher()` |
| `screen.find` / `findAll` / `waitFor` | `screen.find` / `findAll` / `waitFor` |

## Benchmark (NCC vs OpenCV)

Add `packages/plugin-match-opencv/fixtures/screen.png` and `needle.png`, then:

```bash
npm run benchmark --workspace=@spotter/plugin-match-opencv
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
