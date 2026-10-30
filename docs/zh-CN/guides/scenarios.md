# 按场景选择工作流

[English](../../en/guides/scenarios.md)

先按[快速开始](../getting-started.md#源码开发)构建源码。以下示例区分真实桌面、
真实设备和确定性测试替身。

| 目标 | 入口 | 示例与条件 |
|------|------|------------|
| 观察桌面或唯一匹配的窗口 | `screen`、`windows`、`image` | `npx tsx examples/scenarios/inspect-desktop.ts [标题片段]`；需要桌面会话，只保存截图，不执行输入 |
| Agent 读取裁剪截图并解释坐标 | CLI JSON 与截图元数据 | `node examples/scenarios/capture-region.mjs 3 5 8 8`；需要桌面会话，输出原点及坐标换算 |
| 离线验证 OCR 裁剪与坐标契约 | `createOcr({ engine })` | `npx tsx examples/scenarios/ocr-coordinates.ts`；注入文本替身，不下载模型，不验证识别准确率 |
| 查看已配对 Android 设备状态 | Android companion API | `npx tsx examples/scenarios/inspect-android.ts`；需要协议 v2 和 `SPOTTERJS_ANDROID_URL` / `SPOTTERJS_ANDROID_TOKEN`，读取显示与应用状态后关闭连接 |

`npm run smoke:scenarios` 检查 OCR 坐标契约，并让 Android 观察示例连接本机
WebSocket 测试服务。这不能代替 APK、手机权限、真实设备或 OCR 模型推理验证。
桌面示例会截取真实桌面并写入本地文件。标题片段需要唯一匹配；未找到或找到多个窗口
时会报错，不会随意选择窗口。

## 截图坐标

`desktop_capture_screen` 在已有尺寸字段外返回 `origin` 和
`coordinateSpace: "screen"`。即使 `detail: "high"` 缩小预览图，原点仍使用屏幕坐标。
预览点的换算方式：

```typescript
const screenX = capture.origin.x + previewX * capture.originalWidth / capture.width;
const screenY = capture.origin.y + previewY * capture.originalHeight / capture.height;
```

单独调用 `ocr_read_image` 或 `ocr_find_text` 时，请捕获 `detail: "original"`
并传入返回的 `origin`，将图片像素坐标转换为屏幕坐标。独立窗口截图没有这个原点；
需要窗口 OCR 屏幕坐标时，优先使用 `desktop_capture_and_ocr`。换算示例中的几何点
不是检测出的控件，不能直接作为点击依据。

## 等待与恢复

- `windows.waitForTemplate` 只重试“模板未找到”。窗口关闭、模板无法读取或截图失败
  会立即返回错误。零超时执行一次观察；时间参数必须为有限非负数。
- OCR 初始化成功或正在进行时会复用；失败会从缓存移除。修复模型或执行提供程序后，
  可以显式再次尝试，不会自动重试 OCR 请求或输入操作。
- Android 协议 v2 没有请求 ID。超时或收到意外响应后会关闭会话，并拒绝排队的后续命令，
  避免迟到响应被误认为下一步成功。先查看设备实际状态，再显式重新连接，勿盲目重放操作。

本轮实测了 Windows x64 原生截图。Linux/X11、真实 Android 设备和真实 OCR 模型仍需
各自环境验证。
