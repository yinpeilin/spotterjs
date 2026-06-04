# OCR 插件指南

`@spotterjs/plugin-ocr` 在 Node.js 中通过 ONNX Runtime 运行 PP-OCR 风格的检测和识别模型，返回文本行、置信度、区域和中心点。

## 安装

```bash
npm install @spotterjs/plugin-ocr @spotterjs/core
```

## 快速使用

```typescript
import { screen } from "@spotterjs/core";
import { createOcr } from "@spotterjs/plugin-ocr";

const cap = screen.capture();
const ocr = await createOcr();
const lines = await ocr.read(cap);

console.log(lines);
```

## 查找文本

```typescript
const send = await ocr.findText(cap, "发送", {
  exact: false,
});

console.log(send.center);
```

常用 API：

| API | 用途 |
|-----|------|
| `createOcr(options?)` | 创建 OCR client |
| `ensureOcrModels(options?)` | 下载并校验模型文件 |
| `ocr.read(image, options?)` | 读取全部文本行 |
| `ocr.findText(image, text, options?)` | 查找第一条匹配文本 |
| `ocr.findAllText(image, text, options?)` | 查找全部匹配文本 |

`image` 可以是 `CaptureImage`、编码图片 `Buffer` 或图片文件路径。

`ocr.findText` 和 `ocr.findAllText` 默认先走完全相等/包含匹配；如果 OCR 识别有轻微缺字、漏字或多字，可以加 `minSimilarity` 启用相似度阈值匹配：

```typescript
const line = await ocr.findText(cap, "Settings", {
  minSimilarity: 0.85,
});
```

`minSimilarity` 使用归一化编辑距离，范围是 `0` 到 `1`，数值越大越严格。`exact: true` 仍然优先使用完全相等匹配。

## 坐标与裁剪

OCR 结果默认相对输入图片。处理屏幕裁剪图时，传入 `origin` 可以把结果平移回屏幕坐标。

```typescript
const line = await ocr.findText(cap, "Send", {
  origin: { x: 100, y: 200 },
  searchRegion: { left: 10, top: 20, width: 300, height: 120 },
});
```

通过 MCP 截图后再做 OCR 时，截图工具默认会用 `detail: "high"` 控制
artifact 尺寸。识别小字、密集 UI 或需要像素级定位时，先用
`detail: "original"` 获取原尺寸 PNG，再把返回的 `imagePath` 传给
`ocr_read_image` 或 `ocr_find_text`。

## 模型缓存

默认模型会在第一次 `createOcr()` 时下载到用户缓存目录：

| 平台 | 默认目录 |
|------|----------|
| Windows | `%LOCALAPPDATA%/spotterjs/ocr` |
| Linux / macOS | `~/.cache/spotterjs/ocr` |

覆盖缓存目录：

```powershell
$env:SPOTTERJS_OCR_MODEL_DIR="C:\models\spotterjs-ocr"
```

或：

```typescript
await createOcr({ modelDir: "C:/models/spotterjs-ocr" });
```

## 模型 profile 和下载源

```typescript
await createOcr(); // 默认 ppocrv5-server
await createOcr({ modelProfile: "server" });
await createOcr({ modelProfile: "mobile" });
```

下载源：

```typescript
await createOcr({ modelSource: "auto" });
await createOcr({ modelSource: "mirror" });
await createOcr({ modelSource: "origin" });
```

对应环境变量：

```powershell
$env:SPOTTERJS_OCR_MODEL_PROFILE="server"
$env:SPOTTERJS_OCR_MODEL_SOURCE="mirror"
```

## GPU 和前处理

`createOcr()` 可以直接透传 ONNX Runtime execution providers，所以 GPU 不需要单独维护一套 OCR API。

```typescript
await createOcr({
  executionProviders: ["dml", "cpu"],
});
```

Windows 上建议优先使用 `dml`，它基于 DirectML，覆盖 NVIDIA、AMD 和 Intel 显卡；`cuda` 也可以作为可选 provider，但更依赖 NVIDIA 环境。多个 provider 会按顺序尝试，并可回退到 CPU。

也可以在 OCR 前启用轻量前处理：

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

这适合小字、低对比截图和压缩明显的图片。默认不会启用前处理，避免改变现有行为。

默认会先尝试 Hugging Face，再尝试镜像。私有分发可以设置：

```powershell
$env:SPOTTERJS_OCR_MODEL_BASE_URL="https://your-host.example/spotterjs-ocr"
$env:SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL="https://mirror-host.example/spotterjs-ocr"
```

默认 server profile 的远端布局：

```text
detection/v5/det.onnx
languages/chinese/rec.onnx
languages/chinese/dict.txt
```

## 本地模型

```typescript
import { createOcr, resolveLocalOcrModels } from "@spotterjs/plugin-ocr";

const ocr = await createOcr({
  models: resolveLocalOcrModels({
    modelDir: "C:/models/ppocrv5",
  }),
});
```

目录需要包含：

- `det.onnx`：文本检测模型。
- `rec.onnx`：文本识别模型。
- `dict.txt`：识别字典，每行一个字符。

## 集成测试

普通单元测试：

```bash
npm run test -w @spotterjs/plugin-ocr
```

真实 ONNX 集成测试：

```powershell
$env:SPOTTERJS_OCR_INTEGRATION="1"
$env:SPOTTERJS_OCR_MODEL_PROFILE="server"
$env:SPOTTERJS_OCR_TEST_IMAGE="C:\tmp\ocr-sample.png"
$env:SPOTTERJS_OCR_EXPECT_TEXT="发送"
npm run test -w @spotterjs/plugin-ocr -- src/onnx.integration.test.ts
```

更多排障见 [排障指南](../troubleshooting.md)。
## Error handling

`@spotterjs/plugin-ocr` 重新导出 `SpotterError`、`isSpotterError` 和
`toSpotterError`。OCR 错误使用稳定的 `SPOTTER_OCR_*` code、`domain:
"ocr"` 和短小 `context`：

```typescript
import { createOcr, isSpotterError } from "@spotterjs/plugin-ocr";

try {
  const ocr = await createOcr({ modelProfile: "server" });
  await ocr.findText(cap, "Send", { exact: true });
} catch (error) {
  if (isSpotterError(error) && error.code === "SPOTTER_OCR_TEXT_NOT_FOUND") {
    console.log(error.context);
  }
}
```

常见 code 包括 `SPOTTER_OCR_MODEL_PROFILE_UNKNOWN`、
`SPOTTER_OCR_MODEL_DOWNLOAD_FAILED`、`SPOTTER_OCR_MODEL_SHA256_MISMATCH`、
`SPOTTER_OCR_MODEL_FILE_MISSING`、`SPOTTER_OCR_IMAGE_INVALID`、
`SPOTTER_OCR_INVALID_ARGUMENT`、`SPOTTER_OCR_TEXT_NOT_FOUND` 和
`SPOTTER_OCR_ONNX_INVALID_OUTPUT`。
