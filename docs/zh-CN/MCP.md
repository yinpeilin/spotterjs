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
2. 用 `desktop_capture_*` 截图，或直接使用桌面视觉组合工具。
3. 用 OCR、模板匹配或无障碍树检查目标。
4. 用 tap、keyboard、accessibility invoke 或 Android input 执行动作。
5. 只有任务需要本地文件 I/O 时，才使用 host tools 读写工作区文件。

## 典型使用场景

- **代码 Agent 操作本机应用：** 让 Agent 打开开发工具、读取弹窗、点击桌面按钮，或把手动验证步骤变成可复查的脚本。
- **桌面到手机的跨端流程：** 在电脑端改配置或触发后台任务，然后在 Android 设备上启动 App、等待页面元素、截图或点击确认。
- **多台 Android 设备批量验证：** 同时连接不同品牌、分辨率和系统版本的手机，检查同一流程在多设备上的显示和行为。
- **人工操作留痕：** 截图工具会写出 `.spotter/artifacts`，Agent 做过的视觉判断可以通过 artifact 和 debug image 复盘。
- **无稳定 API 的系统集成：** 对只能通过 UI 操作的旧系统，组合窗口、OCR、模板匹配和输入工具完成自动化。

## Agent 调用配方

当 agent 原本需要对同一个桌面画面连续执行「截图、保存、识别、再操作」时，优先使用组合工具。
组合工具会在同一张原始内存截图上完成 OCR 或模板匹配，同时仍写出 PNG artifact 方便复查。

| 目标 | 优先工具 | 原因 |
|------|----------|------|
| 读取当前屏幕或窗口的全部文字 | 不传 `text` 的 `desktop_capture_and_ocr` | 一次截图、一个 artifact，OCR 坐标已平移到屏幕坐标 |
| 查找文字再决定下一步 | 传 `text` 的 `desktop_capture_and_ocr` | 返回 `matches`；传 `debugImage: true` 时还返回 scored `candidates` |
| 按图标或按钮截图查找目标 | `desktop_capture_and_find_template` | 避免先单独截图、再匹配的两次调用 |
| 点击视觉稳定的目标 | `desktop_find_template_and_tap` | 只有模板匹配成功后才会点击 |
| 检查已有图片或外部图片 | `ocr_*` 或底层 `desktop_find_template` | 图片已经存在时使用底层工具更直接 |

所有桌面视觉组合工具都会返回 `coordinateSpace: "screen"`。`region` 只限制
`source: "screen"` 的截图范围；`source: "active"` 和 `source: "window"` 默认截取整个窗口，
并按窗口原点把结果平移到屏幕坐标。`source: "window"` 必须传 `windowId`。

组合工具默认使用 `detail: "original"`，保证 artifact 像素和返回坐标一致。只有当 artifact
主要用于人工查看、而不需要像素级定位时，才建议改成 `detail: "high"`。

Debug image 也是 artifact。它标注的是 OCR 或模板匹配实际使用的本地图像像素；返回结果仍然使用屏幕坐标。
当 agent 需要解释为什么点击、或为什么没有匹配到文字时，建议打开 `debugImage: true`。

## 错误诊断

工具失败时仍返回兼容 MCP 的 `isError: true` 文本结果。底层库提供结构化诊断时，
文本会包含稳定的 `code`、短小的 `context` 摘要和 `domain`：

```text
ocr_find_text failed: OCR text not found: Send (code=SPOTTER_OCR_TEXT_NOT_FOUND context={"text":"Send","exact":true} domain=ocr)
```

重试和排障逻辑可以依赖 `code` 和 `domain`。`context` 只包含短小、可序列化的信息，
不应包含大型二进制数据或敏感文件内容。

## 截图产物

截图工具返回工作区内的 PNG 文件路径，而不是 inline base64。它们接受
`detail: "high" | "original"`。

- `high` 是默认值，会把长边超过 1600 像素的图片缩小。
- `original` 保留完整分辨率，适合 OCR、像素检查和模板调试。
- 桌面视觉组合工具默认使用 `original`；独立截图工具仍保留历史默认值 `high`。

```json
{
  "region": { "left": 0, "top": 0, "width": 1920, "height": 1080 },
  "detail": "original"
}
```

## 调试图产物

Desktop matching、OCR 和 click tools 在传入 `debugImage: true` 时，可以返回带标注的
PNG。调试图路径通过 `debugImagePath` 返回，并写入 `.spotter/artifacts`。

Debug images 是 opt-in。它们保留源图尺寸，因此返回坐标仍能和标注像素对齐。

`score` 保持各引擎原有含义：模板匹配里是后端自己的分数（NCC correlation 或 feature inlier quality），OCR 里是识别置信度。
`matchScore` 是请求匹配逻辑的归一化分数。模板匹配中 `matchScore` 等于 `score`；
OCR 文本匹配中，它表示识别行和查询文本的接近程度。

## 桌面工具

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
| `desktop_capture_and_ocr` | 截图一次、写入 artifact，并执行 OCR |
| `desktop_capture_and_find_template` | 截图一次、写入 artifact，并执行模板匹配 |
| `desktop_find_template_and_tap` | 截图一次、模板匹配，并点击最佳匹配 |

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

组合工具接受同样的模板图片结构，并会把截图 artifact 和屏幕坐标结果一起返回：

```json
{
  "source": "window",
  "windowId": "123456",
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "debugImage": true
}
```

```json
{
  "imagePath": ".spotter/artifacts/desktop-capture-template-2026-06-02T00-00-00-000Z-abc123.png",
  "source": "window",
  "windowId": "123456",
  "origin": { "x": 100, "y": 200 },
  "coordinateSpace": "screen",
  "matches": [
    {
      "region": { "left": 140, "top": 220, "width": 32, "height": 16 },
      "center": { "x": 156, "y": 228 },
      "score": 0.97,
      "matchScore": 0.97,
      "matchAlgorithm": "ncc"
    }
  ],
  "debugImagePath": ".spotter/artifacts/desktop-capture-template-debug-2026-06-02T00-00-00-000Z-def456.png"
}
```

`desktop_find_template_and_tap` 返回单个 `match`、`tapPoint`、截图 artifact 和可选
`debugImagePath`。如果模板匹配失败，它不会点击鼠标。

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

## 无障碍工具

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

## OCR 工具

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

实时桌面 OCR 建议优先使用 `desktop_capture_and_ocr`，除非 agent 已经有需要复用的图片 artifact：

```json
{
  "source": "active",
  "text": "Send",
  "minSimilarity": 0.85,
  "modelProfile": "server",
  "debugImage": true
}
```

## Android 工具

通过 `SPOTTERJS_ANDROID=1` 启用。先通过 WebSocket 与 Spotter mobile companion app
配对，再在后续调用中复用返回的 session token。

`android_connect` 会在 MCP server 中缓存已连接手机，并返回 `deviceId`（未传入时为
`"default"`）。后续 Android tools 可以接受 `{ "deviceId": "default" }`，
也兼容旧的 `{ "url": "...", "sessionToken": "..." }` 结构。

| Tool | 说明 |
|------|------|
| `android_connect` | 与 companion app 配对，或复用 session token |
| `android_disconnect` | 关闭已缓存的 companion session |
| `android_list_devices` | 列出 MCP server 当前缓存的 Android companion sessions |
| `android_heartbeat` | 检查 companion session |
| `android_status` | 获取 companion 状态 |
| `android_display_info` | 获取 Android display size 和 density |
| `android_current_app` | 返回当前聚焦的 Android package / activity |
| `android_launch_app` | 按 Android package name 启动 app |
| `android_capture_screen` | 截取 Android 屏幕并返回 workspace PNG artifact |
| `android_tap` / `android_swipe` / `android_gesture` | 触摸输入 |
| `android_text` | 通过 companion app 输入文本 |
| `android_keyevent` / `android_back` / `android_home` | Android key events |
| `android_dump_tree` | dump Android accessibility tree |
| `android_find_element` / `android_wait_for_element` | 查询 accessibility elements |
| `android_tap_element` / `android_type_element` | 操作 accessibility elements |
| `android_find_template` | 截图一次，并在 Android device 坐标中查找模板图片 |
| `android_find_template_and_tap` | 截图一次、匹配最佳模板，并点击其中心点 |

Android element 和 template 结果使用 `android-device` 坐标。
截图和模板匹配工具返回 workspace PNG artifact，不返回 inline 图片字节。它们默认使用
`detail: "original"`，保证 artifact 像素和返回坐标一致；只有人工查看且不需要像素级定位时，
才建议改用 `detail: "high"`。模板输入与桌面工具一致，可以传 `{ "path": "..." }`
或 `{ "base64": "...", "mimeType": "image/png" }`。

Android 截图需要用户在 companion app 中授权 MediaProjection。Android 14 及更新版本要求
截图运行在 `mediaProjection` foreground service 中，app manifest 已按该要求声明。
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

## Android 多设备编排

如果要在电脑端写代码或让 Agent 操作多台手机，给每台设备分配稳定的 `deviceId`：

```json
{
  "deviceId": "pixel-8",
  "url": "ws://192.168.1.23:17341",
  "code": "123456"
}
```

```json
{
  "deviceId": "galaxy-s24",
  "url": "ws://192.168.1.24:17341",
  "sessionToken": "saved-session-token"
}
```

连接后用 `android_list_devices` 查看当前缓存的设备。后续动作按设备发送：

```json
{ "deviceId": "pixel-8", "packageName": "com.example.app" }
```

```json
{
  "deviceId": "galaxy-s24",
  "textContains": "Login",
  "waitTimeoutMs": 8000,
  "pollMs": 250,
  "maxDepth": 8
}
```

并行执行适合只读或互不影响的任务，例如启动 App、读取状态、截图和等待元素。涉及同一个账号、
同一份后端数据、支付、发消息或删除数据时，建议按设备串行执行，并在每一步后用
`android_current_app`、`android_wait_for_element`、截图或 OCR 验证状态。

## Host 工具

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
