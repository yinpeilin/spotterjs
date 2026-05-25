# @spotterjs/plugin-ocr

OCR plugin for spotterjs. It runs PP-OCR style detection and recognition with ONNX Runtime in Node.js, then returns text-line bounding boxes.

## 安装

```bash
npm install @spotterjs/plugin-ocr @spotterjs/core
```

## 快速开始

```typescript
import { screen } from "@spotterjs/core";
import { createOcr } from "@spotterjs/plugin-ocr";

const cap = screen.capture();
const ocr = await createOcr();
const lines = await ocr.read(cap);
```

`createOcr()` 是创建 OCR client 的主入口。第一次使用时会下载默认 ONNX 模型到用户缓存目录。

## 主要 API

- `createOcr(options?)`：创建 OCR client。
- `ensureOcrModels(options?)`：下载并校验模型文件。
- `ocr.read(image, options?)`：返回全部识别文本行。
- `ocr.findText(image, text, options?)`：返回第一条匹配文本，找不到时抛错。
- `ocr.findAllText(image, text, options?)`：返回全部匹配文本。

`image` 可以是 `CaptureImage`、编码图片 `Buffer` 或图片文件路径。结果包含 `text`、`score`、`region`、`box` 和 `center`。

模型缓存、下载源、本地模型、私有分发和集成测试见 [OCR 插件指南](../../docs/guides/ocr.md)。

## License

Learning and non-commercial use are free. Commercial use requires authorization. See [LICENSE](../../LICENSE).
