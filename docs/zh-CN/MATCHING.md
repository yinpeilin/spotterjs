# 模板匹配

spotterjs 默认使用 **normalized cross-correlation**（NCC，`TM_CCOEFF_NORMED` 语义），由 `spotterjs-plugin-match-ncc` 提供。启用 `feature-match` Cargo feature 的 native 构建还可以通过 `backend: "feature"` 使用 AKAZE 特征匹配后端。

## 架构

```
screen.findTemplate / findAllTemplates / waitForTemplate
  → @spotterjs/node
  → spotterjs-core::matcher
  → spotterjs-plugin-match-ncc
     或 spotterjs-plugin-match-feature [feature-match]

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
- **Backend selection** - 默认 `backend: "ncc"`；native 构建启用 `feature-match` 后可用 `backend: "feature"`。

## 后端选择

`backend: "ncc"` 适合同尺度、同主题的 UI 截图模板，速度快、定位精确；`scale` 选项作用于 NCC。

`backend: "feature"` 使用 AKAZE keypoints、二值描述子、对称匹配、Lowe ratio test 和轻量 consensus 来估计区域。它更能处理缩放和轻微视觉变化，但速度更慢，对很小或低纹理 UI 元素更弱。它的 `score` 是 0..1 的 inlier quality，不是 NCC correlation，因此 `confidence` 阈值不能和 NCC 直接复用。Feature 后端的 `findAll` 当前返回最佳 feature match。

Feature 后端默认不编进 native，以保持构建精简。构建 Rust crate 时启用 `spotterjs-core/feature-match` 或 `spotterjs-node/feature-match`。如果未启用该 feature 却请求 `backend: "feature"`，native 会返回 plugin error，而不是静默回退到 NCC。

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
- `MatchResult`: `{ region, center, score, matchScore, matchAlgorithm }`; `score` 是后端自己的分数，NCC 下是 NCC score，feature 下是 inlier-quality score；`matchScore` 暴露同一个归一化值，`region` / `center` 是屏幕坐标。

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

// Feature backend (requires native feature-match build)
await screen.findTemplate("./scaled-icon.png", {
  backend: "feature",
  confidence: 0.4,
});

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
