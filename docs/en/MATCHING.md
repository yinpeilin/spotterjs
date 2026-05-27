# Template Matching (NCC)

[中文文档](../zh-CN/MATCHING.md)

spotterjs uses normalized cross-correlation (NCC, `TM_CCOEFF_NORMED`
semantics) in `spotterjs-plugin-match-ncc`, exposed through `@spotterjs/node`
and `@spotterjs/core`.

## Architecture

```text
screen.find / findAll / waitFor
  -> @spotterjs/node
  -> spotterjs-core::matcher
  -> spotterjs-plugin-match-ncc

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

## API Matrix

| API | Path needle | Buffer needle | `scale` | `region` |
|-----|-------------|---------------|---------|----------|
| `screen.find` / `findAll` / `waitFor` | Yes | Yes | Yes | Yes |
| `screen.tap` | Yes | Yes | Yes | Yes |
| `windows.findTemplate` / `findAllTemplates` / `tapTemplate` | Yes | Yes | Yes | Yes |
| `image.find` / `findAll` | Yes | Yes | Yes | Yes |

## Core Concepts

- `TemplateImage`: a template input. A `string` is always a file path; a
  `Buffer` is always encoded image bytes, not raw RGBA.
- `CaptureImage`: raw RGBA capture data from `screen.capture`,
  `screen.captureWindow`, Android capture, or native buffer APIs.
- `Region`: `{ left, top, width, height }`.
- `MatchResult`: `{ region, center, score }`.

High-level desktop APIs return screen coordinates. Android APIs return Android
device screenshot coordinates. `image.find` returns coordinates relative to the
provided capture.

## Search Region

When `region` is set, core captures that screen rectangle first, matches inside
the cropped haystack, and translates returned regions back to screen
coordinates. `find` and `findAll` use the same coordinate behavior.

## TypeScript Examples

```typescript
import { screen, windows } from "@spotterjs/core";
import fs from "fs";

const match = await screen.find("./button.png", { confidence: 0.9 });
console.log(match.region, match.center, match.score);

await screen.find("./button.png", {
  confidence: 0.85,
  scale: { min: 0.8, max: 1.2, step: 0.05 },
});

await screen.find(fs.readFileSync("./icon.png"), { confidence: 0.9 });

const matches = await screen.findAll("./button.png", {
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
const match = await image.find(haystack, "./button.png", { confidence: 0.9 });
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
