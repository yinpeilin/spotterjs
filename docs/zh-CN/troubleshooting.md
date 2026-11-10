# 排障指南

[English](../en/troubleshooting.md)

这篇文档用于诊断 spotterjs 常见的安装和自动化问题。

## Native 包加载失败

常见表现：

- `Cannot find module @spotterjs/node-*`
- `Failed to load native binding`
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

高层 `screen.findTemplate` 和 `windows.findTemplate` 返回的坐标可以直接点击。
只有在需要手动转换坐标时，才使用 `toMatchBox` 和 `matchTapScreen`。

## Windows 输入报 SetCursorPos 或 SendInput 错误

`mouse.tap` 会先移动光标，再点击。`SetCursorPos` 失败时，点击及后续键盘输入
都还没有执行。Windows 要求调用线程位于当前接收输入的桌面；桌面或会话变化后，
线程仍绑定旧桌面就可能导致失败。`0x800700CB`（203，找不到环境选项）可能来自
此前残留的 Windows 错误码，不能据此认定缺少环境变量。

spotterjs 会在绑定输入桌面的临时线程上，重试失败的光标操作及被整批拒绝的输入。
调用方线程的桌面保持不变。已经部分成功的按键批次直接报错，不会整批重发，
避免重复输入。

输入错误会保留首次失败、恢复失败的阶段，以及重试前在原调用线程采集的桌面诊断。
`error.context.diagnostics` 包含 `threadDesktop`、`inputDesktop`、
`threadDesktopMatchesInput`、`sessionId`、`windowStation`、`foregroundWindow`，
以及记录诊断采集失败原因的 `errors`；无法读取的字段为 `null`。错误消息也会带上
简明桌面摘要，现有 `logger.error(error.message)` 就能留下这些信息。
诊断自动采集，无需额外脚本或环境变量。

`threadDesktopMatchesInput` 为 `false` 表示采样时桌面名称不一致，`true` 表示名称
一致，`null` 表示无法判断，需结合 `errors` 查看缺失信息。名称一致不能证明具备
输入权限，也不能据此判断是否处于受保护桌面；名称不一致只能证明当时的线程绑定状态，
不能自动确认现场故障的全部原因。

如果恢复仍失败，请在目标用户已解锁的交互会话中运行自动化，检查远程桌面是否已断开、
目标程序是否使用更高权限，以及弹窗是否位于受保护桌面。恢复逻辑仍受 Windows
输入权限及受保护弹窗限制。源码更新后需要运行 `npm run build:native`；
部署应用也需要替换重新构建的 Windows native 二进制，仅更新 JavaScript 不会生效。

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

## CLI Host Tools 无法读写文件

检查：

- `SPOTTERJS_WORKSPACE_ROOT` 是否指向预期工作区。
- 目标路径是否解析到 workspace root 内。
- 写入目标是否为 `.env`、`credentials.json` 等默认禁止文件。
- 需要 shell 执行时，`host_exec` 是否启用了 `SPOTTERJS_ALLOW_SHELL=1`。

更多说明见 [CLI](./CLI.md)。

## 结构化错误 code

first-party 库统一抛出 `SpotterError`，code 形如
`SPOTTER_<DOMAIN>_<REASON>`。应用代码可以用 `isSpotterError(error)` 判断，
并读取 `error.domain` 和 `error.context` 做诊断。

常见安装和环境 code 包括 `SPOTTER_NATIVE_PACKAGE_MISSING`、
`SPOTTER_NATIVE_LOAD_FAILED`、`SPOTTER_OCR_MODEL_DOWNLOAD_FAILED` 和
`SPOTTER_ANDROID_COMPANION_TIMEOUT`。CLI 命令失败时会在 JSON `error` 对象中带上同一套
`code`、摘要后的 `context` 和 `domain`。

## Markdown 检查失败

```bash
npm run docs:check
```

该命令会检查 Markdown 是否是有效 UTF-8，并验证本地 Markdown 链接。
修复损坏编码、相对路径、目录和文件名大小写后重新运行即可。

- Windows 上缺少 MSVC runtime 或 linker 工具

检查清单：

1. 确认平台是 Windows x64 (MSVC) 或 Linux x64 (glibc)。
