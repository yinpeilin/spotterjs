# 排障指南

[English](../en/troubleshooting.md)

这篇文档用于诊断 spotterjs 常见的安装和自动化问题。

## Native 包加载失败

常见表现：

- `Cannot find module @spotterjs/node-*`
- `Failed to load native binding`
- Windows 上缺少 MSVC runtime 或 linker 工具

检查清单：

1. 确认平台是 Windows x64 (MSVC) 或 Linux x64 (glibc)。
2. 使用 `npm ci` 重新安装依赖。
3. 源码开发时运行 `npm run build:native`。
4. 发布前确认 optional native packages 已按顺序构建并发布。

## 模板匹配找不到目标

先检查：

- 模板图片来自同一主题、缩放比例和应用版本。
- `confidence` 没有设置得过高。
- `region` 覆盖了目标区域。
- 目标可见且没有被遮挡。

常用命令：

```bash
npm run smoke:capture
npm run smoke:match
npm run smoke:match-tap
```

图标尺寸变化时使用 `scale`。误匹配较多时缩小 `region`。更多说明见
[模板匹配](./MATCHING.md)。

## 鼠标点击位置偏移

常见原因：

- 把窗口局部坐标当作屏幕坐标使用。
- 多显示器或 DPI 缩放导致坐标理解不一致。
- 混用了窗口外框坐标和客户区坐标。

高层 `screen.find` 和 `windows.findTemplate` 返回的坐标可以直接点击。
只有在需要手动转换坐标时，才使用 `toMatchBox` 和 `matchTapScreen`。

## 无障碍树为空或缺少元素

1. 聚焦目标窗口，并检查是否存在权限边界。
2. 运行 `accessibility.debug.dumpTree(rootId, { treeView: "raw" })`。
3. 对比 `control`、`content` 和 `raw` tree views。
4. 对 custom-drawn UI，使用模板匹配或混合策略。

更多说明见 [无障碍自动化](./guides/accessibility.md)。

## Android Companion 不可用

| 状态 | 处理 |
|------|------|
| WebSocket connection refused | 确认手机 app 正在监听，并且 URL / 端口与 app 页面一致 |
| Pairing fails | 在 app 里刷新配对码，并用 `android.pair` 重试 |
| Session rejected | 重新配对，并复用新的 `sessionToken` |
| Tree or input commands fail | 启用 Spotter accessibility service；需要稳定文本输入时选择 Spotter Keyboard |

更多说明见 [Android companion 自动化](./guides/android-companion.md)。

## OCR 模型下载失败

1. 尝试镜像源：`SPOTTERJS_OCR_MODEL_SOURCE=mirror`。
2. 使用 `SPOTTERJS_OCR_MODEL_DIR` 设置可写缓存目录。
3. 离线环境提前准备 `det.onnx`、`rec.onnx` 和 `dict.txt`。
4. 私有分发时设置 `SPOTTERJS_OCR_MODEL_BASE_URL`。

更多说明见 [OCR 插件](./guides/ocr.md)。

## MCP Host Tools 无法读写文件

检查：

- `SPOTTERJS_WORKSPACE_ROOT` 是否指向预期工作区。
- 目标路径是否解析到 workspace root 内。
- 写入目标是否为 `.env`、`credentials.json` 等默认禁止文件。
- 需要 shell 执行时，`host_exec` 是否启用了 `SPOTTERJS_ALLOW_SHELL=1`。

更多说明见 [MCP Server](./MCP.md)。

## Markdown 检查失败

```bash
npm run docs:check
```

该命令会检查 Markdown 是否是有效 UTF-8，并验证本地 Markdown 链接。
修复损坏编码、相对路径、目录和文件名大小写后重新运行即可。
