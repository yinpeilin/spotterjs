# @spotterjs/plugin-ocr

[中文文档](../../docs/zh-CN/guides/ocr.md)

OCR plugin for spotterjs. It runs PP-OCR-style detection and recognition with
ONNX Runtime in Node.js and returns text-line boxes.

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
```

`createOcr()` creates the OCR client and downloads the default ONNX models on
first use unless local models are provided.

## Main API

- `createOcr(options?)`: create an OCR client.
- `ensureOcrModels(options?)`: download and verify model files.
- `ocr.read(image, options?)`: return all recognized text lines.
- `ocr.findText(image, text, options?)`: return the first matching line or throw.
- `ocr.findAllText(image, text, options?)`: return all matching lines.

`image` can be a `CaptureImage`, encoded image `Buffer`, or image file path.
Read results include `text`, `score`, `region`, `box`, and `center`.
For read results, `score` is OCR recognition confidence. Text lookup results
also include `matchScore`, `matchAlgorithm`, `matchKind`, `query`, and
`matched`. `score` remains OCR recognition confidence; `matchScore` is the
normalized text-query match score.

GPU acceleration uses the same OCR API by passing ONNX Runtime execution
providers:

```typescript
await createOcr({
  executionProviders: ["dml", "cpu"],
});
```

For small or low-contrast text, enable the lightweight preprocessing pipeline:

```typescript
await createOcr({
  preprocess: true,
});
```

Model cache, download sources, local models, private distribution, coordinates,
and integration tests are documented in the [OCR guide](../../docs/en/guides/ocr.md).

## License

Learning and non-commercial use are free. Commercial use requires
authorization. See [LICENSE](../../LICENSE).
