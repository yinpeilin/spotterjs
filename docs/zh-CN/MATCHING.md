# 模板匹配 (NCC)

spotterjs uses **normalized cross-correlation** (NCC, `TM_CCOEFF_NORMED` semantics) in `spotterjs-plugin-match-ncc`, exposed through `@spotterjs/node` and `@spotterjs/core`.

## 架构

```
screen.findTemplate / findAllTemplates / waitForTemplate
  → @spotterjs/node
  → spotterjs-core::matcher
  → spotterjs-plugin-match-ncc

Image decode (path / bytes)     → spotterjs-core::image   [Rust, PNG/JPEG/WebP]
Image encode (MCP base64 PNG)   → spotterjs-core::image   [Rust]
Screen / window capture       → spotterjs-core::capture [platform GDI / X11]
```

See also [CLEANUP-AND-ARCHITECTURE.md](./CLEANUP-AND-ARCHITECTURE.md) for crate boundaries.

## 功能特性

- **Path or Buffer needles** — PNG/JPEG/WebP bytes decoded in Rust (`load_rgba_from_bytes`)
- **Multi-scale** — `scale: true` or `scale: { min, max, step }` (gray Triangle resize per scale; scales run in parallel)
- **Fast NCC scan** — integral-image window stats + SIMD horizontal sliding dot product; row-parallel when `parallel` feature is on (default)
- **Coarse-to-fine pyramid** — single-scale on haystack ≥1920×1080: 0.5× coarse top-3, then ROI refine
- **Search region** — `region` crops before match; results are translated back to screen coordinates

## API 矩阵

| API | path | Buffer | scale | region |
|-----|------|--------|------------|--------------|
| `screen.findTemplate` / `findAllTemplates` / `waitForTemplate` | yes | yes | yes | yes |
| `screen.tapTemplate` | yes | yes | yes | yes |
| `windows.findTemplate` / `findAllTemplates` / `tapTemplate` | yes | yes | yes | yes |
| `image.findTemplate` / `findAllTemplates` | yes | yes | yes | yes |

## 核心概念

- `TemplateImage`: a template input. A `string` is always a file path; a `Buffer` is always encoded image bytes (PNG/JPEG/WebP).
- `CaptureImage`: raw RGBA capture data from `screen.capture`, `captureWindow`, or native buffer APIs.
- `Region`: `{ left, top, width, height }`; high-level APIs use screen coordinates.
- `MatchResult`: `{ region, center, score, matchScore, matchAlgorithm }`; `score` remains the NCC score, `matchScore` is the normalized match score, and `region` / `center` are screen coordinates.

## 搜索区域

When `region` is set, the core captures that screen rectangle first, then resets internal search bounds to `(0, 0, width, height)` on the cropped haystack. **`find` and `findAll` use the same logic**; returned regions are in **screen coordinates**.

## TypeScript

```typescript
import { screen, windows } from "@spotterjs/core";
import fs from "fs";

// File path
const match = await screen.findTemplate("./button.png", { confidence: 0.9 });
console.log(match.region, match.center, match.score);

// Multi-scale
await screen.findTemplate("./button.png", {
  confidence: 0.85,
  scale: { min: 0.8, max: 1.2, step: 0.05 },
});

// In-memory needle (encoded image bytes)
await screen.findTemplate(fs.readFileSync("./icon.png"), { confidence: 0.9 });

// findAllTemplates in a screen sub-region
const matches = await screen.findAllTemplates("./button.png", {
  confidence: 0.9,
  region: { left: 0, top: 0, width: 1920, height: 1080 },
});

// Match inside a window (path or Buffer)
const windowMatch = windows.findTemplate(windowId, "./button.png", { confidence: 0.9 });
windows.findTemplate(windowId, fs.readFileSync("./icon.png"), { confidence: 0.9 });
```

## Native 底层接口

Image utilities (decode / size / PNG encode):

```typescript
import { loadNative } from "@spotterjs/core/unstable-native";

const native = loadNative();
const { width, height } = native.getImageSize("./button.png");
const img = native.loadImageFromPath("./button.png"); // RGBA8
const png = native.encodeCapturePng(hay);             // Buffer
const b64 = native.encodeCapturePngBase64(hay);         // MCP
```

After `captureScreen()`:

```typescript
const hay = native.captureScreen();
const needle = { data: needleRgba, width: 32, height: 32 }; // RGBA8
const rawMatch = native.findTemplateBuffers(hay, needle, { confidence: 0.9 });
```

Screen capture + buffer needle (path empty when using encoded PNG bytes):

```typescript
native.findTemplate("", needlePngBuffer, { confidence: 0.9 });
```

Window + buffer needle:

```typescript
native.findTemplateInWindow(windowId, "", needlePngBuffer, { confidence: 0.9 });
```

## 限制

- No rotation or perspective — scale search only
- Template size up to **512×512**
- `findAll` uses serial peak suppression (parallel applies to single-best `find` only)
- `findTemplateBuffers` expects **raw RGBA8** haystack/needle buffers (not PNG-encoded bytes)

## 性能 (1536×960 hay, 32×32 needle, release)

| Scenario | Pure Rust (`benchmark:ncc:rust`) | With capture (`benchmark:ncc`) |
|----------|----------------------------------|--------------------------------|
| Single scale | ~30 ms | ~70 ms |
| Multi-scale 9 steps | ~150 ms | ~210 ms |

Run benchmarks after `npm run smoke:capture` (writes `test-output/capture.png` + `needle.png`):

```bash
npm run benchmark:ncc:rust -- --runs 20 --warmup 3 --json test-output/benchmark/ncc-rust.json
npm run benchmark:ncc:rust   # match only, no capture overhead
npm run benchmark:ncc        # full screen.findTemplate path
```

For the broader library report, use `npm run benchmark:ci` for synthetic CI-safe
coverage and `npm run benchmark:deep` for local desktop/OCR profiling.

## 破坏性变更 (v0.2)

- Removed `@spotterjs/plugin-match-opencv` and `@spotterjs/node-match-opencv`
- Removed `useMatchPlugin`, `getMatchProvider`, and `createNccMatchProvider` — use `screen.findTemplate` directly
