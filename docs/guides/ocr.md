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

## 坐标与裁剪

OCR 结果默认相对输入图片。处理屏幕裁剪图时，传入 `origin` 可以把结果平移回屏幕坐标。

```typescript
const line = await ocr.findText(cap, "Send", {
  origin: { x: 100, y: 200 },
  searchRegion: { left: 10, top: 20, width: 300, height: 120 },
});
```

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
