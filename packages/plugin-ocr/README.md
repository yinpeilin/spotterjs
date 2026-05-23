# @spotterjs/plugin-ocr

OCR plugin for SpotterJS. It runs PP-OCR style detection and recognition with
ONNX Runtime in Node.js and returns text-line bounding boxes.

```ts
import { screen } from "@spotterjs/core";
import { createOcr } from "@spotterjs/plugin-ocr";

const cap = screen.capture();
const ocr = await createOcr();
const lines = await ocr.read(cap);
```

On first use, `createOcr()` downloads the default ONNX models into the user's
cache directory. Callers do not need to pass a model path.

## API

- `createOcr(options?)`: creates an OCR client.
- `ensureOcrModels(options?)`: downloads and verifies model files.
- `ocr.read(image, options?)`: returns all recognized text lines.
- `ocr.findText(image, text, options?)`: returns the first matching line or throws.
- `ocr.findAllText(image, text, options?)`: returns every matching line.

`image` can be a `CaptureImage`, encoded image `Buffer`, or image file path.
Results contain `text`, `score`, `region`, `box`, and `center`.

## Coordinates

OCR results are relative to the input image by default. Pass `origin` when the
image is a screen crop and `searchRegion` when only part of the image should be
processed.

```ts
const line = await ocr.findText(cap, "Send", {
  origin: { x: 100, y: 200 },
  searchRegion: { left: 10, top: 20, width: 300, height: 120 },
});
```

## Models

The default profile is `ppocrv5-server`. `createOcr()` automatically downloads
the model files on first use and caches them in:

- Windows: `%LOCALAPPDATA%/spotterjs/ocr`
- Linux/macOS: `~/.cache/spotterjs/ocr`

Override the cache directory with `SPOTTERJS_OCR_MODEL_DIR` or
`createOcr({ modelDir })`.

Two built-in model profiles are available:

```ts
await createOcr(); // default: ppocrv5-server, higher accuracy
await createOcr({ modelProfile: "server" });
await createOcr({ modelProfile: "mobile" }); // smaller and faster
```

`server` uses the PP-OCRv5 detection and Chinese recognition files from
`monkt/paddleocr-onnx`. `mobile` uses the smaller PP-OCRv5 mobile ONNX files
from `ilaylow/PP_OCRv5_mobile_onnx` plus the same Chinese dictionary.

By default, downloads try Hugging Face first and then fall back to a mirror:

```text
https://huggingface.co/monkt/paddleocr-onnx/resolve/main
https://hf-mirror.com/monkt/paddleocr-onnx/resolve/main
```

Use `modelSource` to control download behavior:

```ts
await createOcr({ modelSource: "auto" });   // default: origin, then mirror
await createOcr({ modelSource: "mirror" }); // force mirror
await createOcr({ modelSource: "origin" }); // force Hugging Face
```

The same setting is available through `SPOTTERJS_OCR_MODEL_SOURCE`, with values
`auto`, `mirror`, or `origin`.

The model profile can also be selected with `SPOTTERJS_OCR_MODEL_PROFILE`, with
values `server`, `mobile`, `ppocrv5-server`, or `ppocrv5-mobile`.

Mirror the same file layout to your own repository or object storage and set:

```powershell
$env:SPOTTERJS_OCR_MODEL_BASE_URL="https://your-host.example/spotterjs-ocr"
$env:SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL="https://mirror-host.example/spotterjs-ocr"
```

The expected default server remote layout is:

```text
detection/v5/det.onnx
languages/chinese/rec.onnx
languages/chinese/dict.txt
```

For development and debugging, local model files can still be used directly:

```ts
import { createOcr, resolveLocalOcrModels } from "@spotterjs/plugin-ocr";

const ocr = await createOcr({
  models: resolveLocalOcrModels({
    modelDir: "C:/models/ppocrv5",
  }),
});
```

`modelDir` must contain:

- `det.onnx`: text detection model
- `rec.onnx`: text recognition model
- `dict.txt`: recognition dictionary, one character per line

If your model uses non-default input sizes or names:

```ts
resolveLocalOcrModels({
  modelDir: "C:/models/ppocrv5",
  detInputWidth: 960,
  detInputHeight: 960,
  recInputWidth: 320,
  recInputHeight: 48,
  detInputName: "x",
  recInputName: "x",
});
```

For private distribution, pass a custom `profile` with your own ONNX model URLs
and SHA-256 values to `createOcr({ profile })` or `ensureOcrModels({ profile })`.

Use `scripts/prepare-ocr-models.mjs` from the repository root to convert Paddle
inference models with Paddle2ONNX and generate a manifest:

```bash
node scripts/prepare-ocr-models.mjs \
  --det ./models/det_infer \
  --rec ./models/rec_infer \
  --dict ./models/ppocr_keys_v1.txt \
  --out ./test-output/ocr-models \
  --base-url https://example.com/ocr
```

## Local ONNX Test

Run the normal unit tests:

```bash
npm run test -w @spotterjs/plugin-ocr
```

Run the real ONNX integration test with automatic model download and a test image:

```powershell
$env:SPOTTERJS_OCR_INTEGRATION="1"
$env:SPOTTERJS_OCR_MODEL_PROFILE="server"
$env:SPOTTERJS_OCR_TEST_IMAGE="C:\tmp\ocr-sample.png"
$env:SPOTTERJS_OCR_EXPECT_TEXT="发送"
npm run test -w @spotterjs/plugin-ocr -- src/onnx.integration.test.ts
```

Run the same test against local model files:

```powershell
$env:SPOTTERJS_OCR_INTEGRATION="1"
$env:SPOTTERJS_OCR_MODEL_DIR="C:\models\ppocrv5"
$env:SPOTTERJS_OCR_TEST_IMAGE="C:\tmp\ocr-sample.png"
$env:SPOTTERJS_OCR_EXPECT_TEXT="发送"
npm run test -w @spotterjs/plugin-ocr -- src/onnx.integration.test.ts
```

The test loads or downloads `det.onnx`, `rec.onnx`, and `dict.txt`, runs OCR on
the image, asserts that at least one text line with a non-empty box is returned,
and prints the recognized lines as JSON.
## License

Learning and non-commercial use are free. Commercial use requires authorization;
see [LICENSE](../../LICENSE) or contact `ypl123698745@qq.com`.
