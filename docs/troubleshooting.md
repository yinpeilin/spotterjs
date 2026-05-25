# 排障指南

这篇文档覆盖 spotterjs 最常见的问题。优先按症状定位，再回到对应指南补细节。

## native 包加载失败

常见表现：

- `Cannot find module @spotterjs/node-*`
- `Failed to load native binding`
- Windows 上提示缺少 MSVC 运行时或 `link.exe`

处理步骤：

1. 确认平台是 Windows x64 (MSVC) 或 Linux x64 (glibc)。
2. 重新安装依赖：`npm ci`。
3. 源码开发时运行：`npm run build:native`。
4. 打包发布前确认 optional native package 已按 [发布手册](./PUBLISHING.md) 先发布。

## 模板匹配找不到目标

先确认：

- 模板图片来自同一主题、缩放比例和应用版本。
- `confidence` 没有设置得过高。
- `region` 覆盖了目标区域。
- 目标没有被遮挡，窗口处于前台或可截图状态。

调试建议：

```bash
npm run smoke:capture
npm run smoke:match
npm run smoke:match-tap
```

当图标尺寸可能变化时，开启 `scale`；当误匹配较多时，缩小 `region`。更多细节见 [模板匹配](./MATCHING.md)。

## 鼠标点击位置偏移

常见原因：

- 把窗口局部坐标当作屏幕坐标使用。
- 多显示器或 DPI 缩放导致截图区域和点击区域理解不一致。
- 使用了窗口外框坐标，而目标区域来自客户区截图。

处理方式：

- 高层 `screen.find` 和 `windows.findTemplate` 返回值优先按文档说明使用。
- 需要手动换算时，用 `toMatchBox` 和 `matchTapScreen`。
- 运行 `npm run smoke:match-tap` 验证当前平台的坐标路径。

## 无障碍树为空或查不到元素

处理步骤：

1. 确认目标窗口已聚焦且没有权限隔离问题。
2. 运行 `accessibility.debug.dumpTree(rootId, { treeView: "raw" })`。
3. 对比 `control`、`content` 和 `raw` 三种树视图。
4. 如果应用是自绘 UI，改用模板匹配或组合策略。

更多说明见 [无障碍自动化](./guides/accessibility.md)。

## ADB 设备不可用

常见状态：

| 状态 | 处理 |
|------|------|
| `unauthorized` | 在手机上接受 USB 调试授权，必要时重新插拔 |
| `offline` | 执行 `adb kill-server` 后重连 |
| 找不到 `adb` | 设置 `SPOTTERJS_ADB_PATH` 或安装 Android SDK platform-tools |
| 无线调试失败 | 确认配对端口和连接端口没有混用 |

先运行：

```typescript
const devices = await android.discover();
console.log(devices);
```

更多说明见 [Android ADB 自动化](./guides/android-adb.md)。

## OCR 模型下载失败

处理步骤：

1. 设置镜像源：`SPOTTERJS_OCR_MODEL_SOURCE=mirror`。
2. 指定缓存目录：`SPOTTERJS_OCR_MODEL_DIR`。
3. 在离线环境中预先准备 `det.onnx`、`rec.onnx` 和 `dict.txt`。
4. 私有分发时设置 `SPOTTERJS_OCR_MODEL_BASE_URL`。

更多说明见 [OCR 插件](./guides/ocr.md)。

## MCP host 工具无法读写文件

检查：

- `SPOTTERJS_WORKSPACE_ROOT` 是否指向允许访问的工作区。
- 目标路径是否在 workspace root 内。
- 写入目标是否是 `.env`、`credentials.json` 等默认禁止文件。
- `host_exec` 是否设置了 `SPOTTERJS_ALLOW_SHELL=1`。

更多说明见 [MCP Server](./MCP.md)。

## Markdown 链接检查失败

运行：

```bash
npm run docs:check
```

脚本只检查本地相对链接。修复方式通常是：

- 改正相对路径。
- 如果链接到目录，确保目录存在。
- 如果链接到具体文件，确保文件名大小写一致。
- 外链、邮箱和锚点-only 链接不需要处理。
