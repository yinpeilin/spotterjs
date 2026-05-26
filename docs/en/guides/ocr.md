# OCR Plugin Guide

[中文文档](../../zh-CN/guides/ocr.md)

`@spotterjs/plugin-ocr` runs PP-OCR-style detection and recognition models with
ONNX Runtime in Node.js. It returns text lines with text, score, region,
four-point box, and center coordinates.

## Install

```bash
npm install @spotterjs/plugin-ocr @spotterjs/core
```

## Quick Start

```typescript
import { screen } from "@spotterjs/core";
import { createOcr } from "@spotterjs/plugin-ocr";

const cap = screen.capture();
const ocr = await createOcr();
const lines = await ocr.read(cap);

console.log(lines);
```

## Find Text

```typescript
const send = await ocr.findText(cap, "Send", {
  exact: false,
});

console.log(send.center);
```

Common API:

| API | Purpose |
|-----|---------|
| `createOcr(options?)` | Create an OCR client |
| `ensureOcrModels(options?)` | Download and verify model files |
| `ocr.read(image, options?)` | Read all text lines |
| `ocr.findText(image, text, options?)` | Return the first matching text line |
| `ocr.findAllText(image, text, options?)` | Return all matching text lines |

`image` can be a `CaptureImage`, encoded image `Buffer`, or image file path.

`ocr.findText` and `ocr.findAllText` still use exact/contains matching first.
If OCR output has a small omission, insertion, or typo, you can set
`minSimilarity` to enable thresholded fuzzy matching:

```typescript
const line = await ocr.findText(cap, "Settings", {
  minSimilarity: 0.85,
});
```

`minSimilarity` uses normalized edit distance from `0` to `1`. Higher values
are stricter. `exact: true` still takes priority.

## Error Handling

`@spotterjs/plugin-ocr` exports `OcrError`, `OcrErrorCode`, and `isOcrError`.
OCR APIs still throw normal `Error` instances, but structured failures include
stable `code` values and small diagnostic `context` objects.

```typescript
import { createOcr, isOcrError } from "@spotterjs/plugin-ocr";

try {
  const ocr = await createOcr({ modelProfile: "server" });
  await ocr.findText(cap, "Send", { exact: true });
} catch (error) {
  if (isOcrError(error) && error.code === "OCR_TEXT_NOT_FOUND") {
    console.log(error.context);
  }
}
```

Common codes include `OCR_MODEL_PROFILE_UNKNOWN`,
`OCR_MODEL_DOWNLOAD_FAILED`, `OCR_MODEL_SHA256_MISMATCH`,
`OCR_MODEL_FILE_MISSING`, `OCR_IMAGE_INVALID`, `OCR_INVALID_ARGUMENT`,
`OCR_TEXT_NOT_FOUND`, and `OCR_ONNX_INVALID_OUTPUT`.

## Coordinates and Cropping

OCR results are relative to the input image by default. When you OCR a cropped
screen image, pass `origin` to translate results back to screen coordinates.

```typescript
const line = await ocr.findText(cap, "Send", {
  origin: { x: 100, y: 200 },
  searchRegion: { left: 10, top: 20, width: 300, height: 120 },
});
```

When using OCR after MCP capture, capture tools default to `detail: "high"` and
may downscale the artifact. Use `detail: "original"` for small text, dense UI,
or pixel-level positioning, then pass the returned `imagePath` to
`ocr_read_image` or `ocr_find_text`.

## Model Cache

Default models are downloaded on first `createOcr()` use:

| Platform | Default directory |
|----------|-------------------|
| Windows | `%LOCALAPPDATA%/spotterjs/ocr` |
| Linux / macOS | `~/.cache/spotterjs/ocr` |

Override the cache directory:

```powershell
$env:SPOTTERJS_OCR_MODEL_DIR="C:\models\spotterjs-ocr"
```

or:

```typescript
await createOcr({ modelDir: "C:/models/spotterjs-ocr" });
```

## Model Profiles and Sources

```typescript
await createOcr(); // default ppocrv5-server
await createOcr({ modelProfile: "server" });
await createOcr({ modelProfile: "mobile" });
```

Download source:

```typescript
await createOcr({ modelSource: "auto" });
await createOcr({ modelSource: "mirror" });
await createOcr({ modelSource: "origin" });
```

Environment variables:

```powershell
$env:SPOTTERJS_OCR_MODEL_PROFILE="server"
$env:SPOTTERJS_OCR_MODEL_SOURCE="mirror"
```

## GPU and Preprocessing

`createOcr()` forwards ONNX Runtime execution providers directly, so there is
no separate OCR code path for GPU support.

```typescript
await createOcr({
  executionProviders: ["dml", "cpu"],
});
```

On Windows, `dml` is the most practical GPU option for broad hardware support.
`cuda` can also be used, but it is mainly a NVIDIA-oriented path. Providers are
tried in order and can fall back to CPU.

You can also enable lightweight preprocessing before OCR:

```typescript
await createOcr({
  preprocess: {
    grayscale: true,
    normalize: true,
    sharpen: true,
    scale: 2,
  },
});
```

This is useful for small text, low-contrast screenshots, and compressed images.
It is off by default.

By default, the downloader tries the origin first, then the mirror. Private
distribution can override both base URLs:

```powershell
$env:SPOTTERJS_OCR_MODEL_BASE_URL="https://your-host.example/spotterjs-ocr"
$env:SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL="https://mirror-host.example/spotterjs-ocr"
```

Default server profile remote layout:

```text
detection/v5/det.onnx
languages/chinese/rec.onnx
languages/chinese/dict.txt
```

## Local Models

```typescript
import { createOcr, resolveLocalOcrModels } from "@spotterjs/plugin-ocr";

const ocr = await createOcr({
  models: resolveLocalOcrModels({
    modelDir: "C:/models/ppocrv5",
  }),
});
```

The directory must contain:

- `det.onnx`: text detection model.
- `rec.onnx`: text recognition model.
- `dict.txt`: recognition dictionary, one character per line.

## Tests

Unit tests:

```bash
npm run test -w @spotterjs/plugin-ocr
```

Real ONNX integration test:

```powershell
$env:SPOTTERJS_OCR_INTEGRATION="1"
$env:SPOTTERJS_OCR_MODEL_PROFILE="server"
$env:SPOTTERJS_OCR_TEST_IMAGE="C:\tmp\ocr-sample.png"
$env:SPOTTERJS_OCR_EXPECT_TEXT="Send"
npm run test -w @spotterjs/plugin-ocr -- src/onnx.integration.test.ts
```

More troubleshooting is available in [Troubleshooting](../troubleshooting.md).
