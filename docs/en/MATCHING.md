# Template Matching

[中文文档](../zh-CN/MATCHING.md)

spotterjs uses normalized cross-correlation (NCC, `TM_CCOEFF_NORMED`
semantics) by default through `spotterjs-plugin-match-ncc`. Builds that enable
the `feature-match` Cargo feature can also use an AKAZE feature backend through
`backend: "feature"`.

## Architecture

```text
screen.findTemplate / findAllTemplates / waitForTemplate
  -> @spotterjs/node
  -> spotterjs-core::matcher
  -> spotterjs-plugin-match-ncc
     or spotterjs-plugin-match-feature [feature-match]

Image decode (path / bytes)   -> spotterjs-core::image   [Rust, PNG/JPEG/WebP]
Image encode (PNG / base64)   -> spotterjs-core::image   [Rust]
Screen / window capture       -> spotterjs-core::capture [platform GDI / X11]
```

## Features

- Path or Buffer needles: strings are file paths; Buffers are encoded PNG/JPEG/WebP bytes.
- Multi-scale matching: `scale: true` or `scale: { min, max, step }`.
- Fast NCC scan: integral-image window stats and optimized dot products.
- Coarse-to-fine pyramid for large single-scale haystacks.
- Search regions: `region` crops before matching and translates results back to screen coordinates.
- Backend selection: `backend: "ncc"` by default, or `backend: "feature"` when
  native binaries are built with `feature-match`.

## Backends

`backend: "ncc"` is fast and precise when the needle is a same-scale screenshot
of the target UI. `scale` options apply to NCC.

`backend: "feature"` uses AKAZE keypoints, binary descriptors, symmetric
matching, Lowe ratio filtering, and a small consensus step to estimate the
region. It is more tolerant of scale and mild visual changes, but is slower and
weaker on very small or low-texture UI. Its `score` is an inlier-quality value
from 0 to 1, not an NCC correlation score, so confidence thresholds are not
directly interchangeable with NCC. Feature `findAll` currently returns the best
feature match.

The feature backend is gated to keep default native builds slim. Enable
`spotterjs-core/feature-match` or `spotterjs-node/feature-match` when building
native crates. Without that feature, requesting `backend: "feature"` returns a
native plugin error instead of silently falling back to NCC.

## API Matrix

| API | Path needle | Buffer needle | `scale` | `region` |
|-----|-------------|---------------|---------|----------|
| `screen.findTemplate` / `findAllTemplates` / `waitForTemplate` | Yes | Yes | Yes | Yes |
| `screen.tapTemplate` | Yes | Yes | Yes | Yes |
| `windows.findTemplate` / `findAllTemplates` / `tapTemplate` | Yes | Yes | Yes | Yes |
| `image.findTemplate` / `findAllTemplates` | Yes | Yes | Yes | Yes |

## Core Concepts

- `TemplateImage`: a template input. A `string` is always a file path; a
  `Buffer` is always encoded image bytes, not raw RGBA.
- `CaptureImage`: raw RGBA capture data from `screen.capture`,
  `screen.captureWindow`, Android capture, or native buffer APIs.
- `Region`: `{ left, top, width, height }`.
- `MatchResult`: `{ region, center, score, matchScore, matchAlgorithm }`.
  `score` remains the backend-native score; for NCC it is the NCC score, and
  for feature matching it is an inlier-quality score. `matchScore` is the same
  normalized value exposed consistently across match APIs.

High-level desktop APIs return screen coordinates. Android APIs return Android
device screenshot coordinates. `image.findTemplate` returns coordinates relative to the
provided capture.

## Search Region

When `region` is set, core captures that screen rectangle first, matches inside
the cropped haystack, and translates returned regions back to screen
coordinates. `find` and `findAll` use the same coordinate behavior.

## TypeScript Examples

```typescript
import { screen, windows } from "@spotterjs/core";
import fs from "fs";

const match = await screen.findTemplate("./button.png", { confidence: 0.9 });
console.log(match.region, match.center, match.score);

await screen.findTemplate("./button.png", {
  confidence: 0.85,
  scale: { min: 0.8, max: 1.2, step: 0.05 },
});

await screen.findTemplate(fs.readFileSync("./icon.png"), { confidence: 0.9 });

await screen.findTemplate("./scaled-icon.png", {
  backend: "feature",
  confidence: 0.4,
});

const matches = await screen.findAllTemplates("./button.png", {
  confidence: 0.9,
  region: { left: 0, top: 0, width: 1920, height: 1080 },
});

const windowMatch = windows.findTemplate(windowId, "./button.png", {
  confidence: 0.9,
});
```

## Matching an Existing Capture

```typescript
import { image, screen } from "@spotterjs/core";

const haystack = screen.capture();
const match = await image.findTemplate(haystack, "./button.png", { confidence: 0.9 });
```

Use `image.decode(encodedBytes)` when you have encoded PNG/JPEG/WebP bytes and
need a raw RGBA `CaptureImage`.

## Low-Level Native Escape Hatch

```typescript
import { loadNative } from "@spotterjs/core/unstable-native";

const native = loadNative();
const { width, height } = native.getImageSize("./button.png");
const img = native.loadImageFromPath("./button.png");
const png = native.encodeCapturePng(img);
const b64 = native.encodeCapturePngBase64(img);
```

Prefer high-level APIs unless you need a native capability that has not yet
been wrapped.

## Limits

- No rotation or perspective matching; scale search only.
- Template size is limited by the native matcher.
- `findAll` uses peak suppression and native sorting.
- Native `findTemplateBuffers` expects raw RGBA buffers, while high-level
  Buffer needles expect encoded image bytes.

## Benchmarks

```bash
npm run benchmark:ncc:rust
npm run benchmark:ncc
npm run benchmark:ci
npm run benchmark:deep
```

`benchmark:ncc:rust` measures matching without capture overhead.
`benchmark:ncc` includes capture and TypeScript calls. `benchmark:ci` is a
stable synthetic report; `benchmark:deep` is intended for local desktop/OCR
profiling.
