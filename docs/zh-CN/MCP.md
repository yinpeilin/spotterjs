# spotterjs MCP Server (`@spotterjs/mcp`)

[English](../en/MCP.md)

spotterjs MCP server 向 Cursor、Claude Desktop 等 MCP clients 暴露桌面自动化、
可选 Android companion 自动化、OCR、工作区文件 I/O，以及受控 shell 执行能力。

## 安装

```bash
npm install @spotterjs/mcp @spotterjs/core
```

开发构建：

```bash
npm run build -w @spotterjs/node
npm run build -w @spotterjs/core
npm run build -w @spotterjs/mcp
```

## Cursor / Claude 配置

```json
{
  "mcpServers": {
    "spotterjs": {
      "command": "npx",
      "args": ["-y", "@spotterjs/mcp"],
      "env": {
        "SPOTTERJS_WORKSPACE_ROOT": "C:/path/to/your/project",
        "SPOTTERJS_ALLOW_SHELL": "1",
        "SPOTTERJS_A11Y": "1"
      }
    }
  }
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SPOTTERJS_WORKSPACE_ROOT` | `process.cwd()` | `host_*` 文件工具的 sandbox root |
| `SPOTTERJS_ALLOW_SHELL` | `0` | 设为 `1` 后启用 `host_exec` |
| `SPOTTERJS_FS_MAX_BYTES` | `1048576` | 单次文件读写和 command stream 的最大字节数 |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | `60000` | shell command timeout |
| `SPOTTERJS_SHELL` | auto | 覆盖默认 shell executable |
| `SPOTTERJS_A11Y` | off | 设为 `1` 后注册 accessibility tools |
| `SPOTTERJS_ANDROID` | off | 设为 `1` 后注册 Android companion tools |

使用 `host_shell_info` 可以确认命令会通过 PowerShell、bash 还是自定义 shell 运行。

## 推荐工具流程

1. 用 `desktop_list_windows`、`desktop_list_apps` 或 Android discovery 找到目标。
2. 用 `desktop_capture_*` 或 `android_capture_screen` 截图。
3. 用 OCR、模板匹配或无障碍树检查目标。
4. 用 tap、keyboard、accessibility invoke 或 Android input 执行动作。
5. 只有任务需要本地文件 I/O 时，才使用 host tools 读写工作区文件。

## 错误诊断

工具失败时仍返回兼容 MCP 的 `isError: true` 文本结果。底层库提供结构化诊断时，
文本会包含稳定的 `code` 和短小的 `context` 摘要：

```text
ocr_find_text failed: OCR text not found: Send (code=OCR_TEXT_NOT_FOUND context={"text":"Send","exact":true})
```

重试和排障逻辑可以依赖 `code`。`context` 只包含短小、可序列化的信息，
不应包含大型二进制数据或敏感文件内容。

## 截图产物

截图工具返回工作区内的 PNG 文件路径，而不是 inline base64。它们接受
`detail: "high" | "original"`。

- `high` 是默认值，会把长边超过 1600 像素的图片缩小。
- `original` 保留完整分辨率，适合 OCR、像素检查和模板调试。

```json
{
  "region": { "left": 0, "top": 0, "width": 1920, "height": 1080 },
  "detail": "original"
}
```

## Debug Image 产物

Desktop matching、OCR 和 click tools 在传入 `debugImage: true` 时，可以返回带标注的
PNG。调试图路径通过 `debugImagePath` 返回，并写入 `.spotter/artifacts`。

Debug images 是 opt-in。它们保留源图尺寸，因此返回坐标仍能和标注像素对齐。

`score` 保持各引擎原有含义：模板匹配里是 NCC score，OCR 里是识别置信度。
`matchScore` 是请求匹配逻辑的归一化分数。模板匹配中 `matchScore` 等于 `score`；
OCR 文本匹配中，它表示识别行和查询文本的接近程度。

## Desktop Tools

| Tool | 说明 |
|------|------|
| `desktop_list_windows` | 列出可见顶层窗口，并返回 process metadata |
| `desktop_list_apps` | 按 process 聚合桌面应用 |
| `desktop_get_active_window` | 返回前台窗口 |
| `desktop_capture_screen` | 截取整个屏幕或 region，并返回 workspace PNG |
| `desktop_capture_window` | 按 window ID 截图，并返回 workspace PNG |
| `desktop_capture_active` | 截取前台窗口，并返回 workspace PNG |
| `desktop_focus_window` | 将窗口带到前台 |
| `desktop_mouse_move` / `desktop_mouse_click` / `desktop_mouse_tap` | 鼠标输入 |
| `desktop_keyboard_type` / `desktop_keyboard_tap` | 输入文本，或点击命名键/数字键 |
| `desktop_clipboard_get` / `desktop_clipboard_set` | 剪贴板文本 |
| `desktop_find_template` | 在屏幕上做模板匹配 |

模板输入可以是文件路径，也可以是编码后的图片字节：

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "region": { "left": 100, "top": 50, "width": 800, "height": 600 },
  "scale": true,
  "all": true,
  "debugImage": true
}
```

响应使用屏幕坐标：

```json
{
  "matches": [
    {
      "region": { "left": 100, "top": 50, "width": 32, "height": 16 },
      "center": { "x": 116, "y": 58 },
      "score": 0.97,
      "matchScore": 0.97,
      "matchAlgorithm": "ncc"
    }
  ],
  "coordinateSpace": "screen",
  "debugImagePath": ".spotter/artifacts/desktop-find-template-debug-2026-06-02T00-00-00-000Z-abc123.png"
}
```

## Accessibility Tools

通过 `SPOTTERJS_A11Y=1` 启用。

| Tool | 说明 |
|------|------|
| `desktop_a11y_attach_window` | 挂载 UIA / AT-SPI tree，并返回诊断信息 |
| `desktop_a11y_find` | 按名称、类型或 automation ID 查找元素 |
| `desktop_a11y_invoke` | 调用元素 pattern |
| `desktop_a11y_tap_element` | 点击元素中心点 |
| `desktop_a11y_dump_tree` | dump accessibility tree |
| `desktop_a11y_element_info` | 返回单个元素 metadata |

控件名称或 automation ID 稳定时优先使用 accessibility。目标视觉稳定但没有语义暴露时，
优先使用模板匹配。

## OCR Tools

| Tool | 说明 |
|------|------|
| `ocr_read_image` | 从 workspace image path 读取文本行 |
| `ocr_find_text` | 在 workspace image path 里查找匹配文本行 |

典型流程：

```json
{
  "imagePath": "test-output/mcp/capture.png",
  "text": "Send",
  "exact": false,
  "minSimilarity": 0.85,
  "modelProfile": "server",
  "debugImage": true
}
```

如果图片是 crop，并且结果需要转换回另一个坐标空间，可以传入 `origin`。

`ocr_find_text` 返回 OCR 匹配结果，同时包含识别置信度和文本匹配诊断：

```json
{
  "imagePath": "test-output/mcp/capture.png",
  "matches": [
    {
      "text": "Send",
      "score": 0.95,
      "matchScore": 1,
      "matchAlgorithm": "ocr-text",
      "matchKind": "contains",
      "query": "Send",
      "matched": true,
      "region": { "left": 100, "top": 50, "width": 40, "height": 16 },
      "center": { "x": 120, "y": 58 }
    }
  ],
  "debugImagePath": ".spotter/artifacts/ocr-find-text-debug-2026-06-02T00-00-00-000Z-abc123.png"
}
```

当 `debugImage: true` 时，响应还会包含所有识别行的 scored `candidates`，
方便在 no-match 场景下检查候选文本，而不用重新运行 OCR。

## Android Tools

通过 `SPOTTERJS_ANDROID=1` 启用。先通过 WebSocket 与 Spotter mobile companion app
配对，再在后续调用中复用返回的 session token。

`android_connect` 会在 MCP server 中缓存已连接手机，并返回 `deviceId`（未传入时为
`"default"`）。后续 Android tools 可以接受 `{ "deviceId": "default" }`，
也兼容旧的 `{ "url": "...", "sessionToken": "..." }` 结构。

| Tool | 说明 |
|------|------|
| `android_connect` | 与 companion app 配对，或复用 session token |
| `android_disconnect` | 关闭已缓存的 companion session |
| `android_heartbeat` | 检查 companion session |
| `android_status` | 获取 companion 状态 |
| `android_display_info` | 获取 Android display size 和 density |
| `android_current_app` | 返回当前聚焦的 Android package / activity |
| `android_launch_app` | 按 Android package name 启动 app |
| `android_capture_screen` | companion frame capture 实现前暂不可用 |
| `android_tap` / `android_swipe` / `android_gesture` | 触摸输入 |
| `android_text` | 通过 companion app 输入文本 |
| `android_keyevent` / `android_back` / `android_home` | Android key events |
| `android_dump_tree` | dump Android accessibility tree |
| `android_find_element` / `android_wait_for_element` | 查询 accessibility elements |
| `android_tap_element` / `android_type_element` | 操作 accessibility elements |
| `android_find_template` | companion frame capture 实现前暂不可用 |

Android element 和 template 结果使用 `android-device` 坐标。
`android_wait_for_element` 使用 `waitTimeoutMs` 控制 UI element wait timeout；
同时支持可选 `pollMs` 和 `maxDepth`。`timeoutMs` 仍保留给 WebSocket request timeout。

示例流程：

```json
{ "url": "ws://192.168.1.23:17341", "code": "123456" }
```

```json
{ "deviceId": "default", "packageName": "com.android.settings" }
```

```json
{
  "deviceId": "default",
  "textContains": "Settings",
  "waitTimeoutMs": 5000,
  "pollMs": 250,
  "maxDepth": 8
}
```

## Host Tools

| Tool | 说明 |
|------|------|
| `host_read_file` | 读取 workspace 内的文本文件 |
| `host_write_file` | 写入 workspace 内的文本文件 |
| `host_list_dir` | 列出目录项 |
| `host_stat` | 返回文件 metadata |
| `host_open_file` | 用系统默认 app 打开文件或目录 |
| `host_shell_info` | 返回 shell executable 和 syntax hint |
| `host_exec` | 启用后运行 shell command |

## 安全策略

- 文件路径必须解析到 `SPOTTERJS_WORKSPACE_ROOT` 内。
- 默认阻止写入 `.env`、`credentials.json` 等敏感文件。
- 除非设置 `SPOTTERJS_ALLOW_SHELL=1`，否则 shell execution 处于禁用状态。
- Desktop 和 Android tools 可以控制真实设备；只在可信机器上启用。

## 手动验证

```bash
npm run smoke:desktop
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

配置 workspace root 后，验证 `host_shell_info`、`desktop_list_apps` 和 `host_read_file`。
