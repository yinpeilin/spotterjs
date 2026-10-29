# spotterjs CLI + Skill（`@spotterjs/cli`）

[English](../en/CLI.md)

直接通过 shell 执行桌面、Android companion、OCR 和工作区操作。每次调用接收 JSON 参数，
向 stdout 输出一份 JSON 结果后退出。Agent 可以安装随包分发的 Skill，按统一流程发现命令、
观察界面、执行操作并验证结果。

## 安装与验证

使用已发布版本：

```bash
npm install -g @spotterjs/cli
spotterjs --version
spotterjs --help
spotterjs list
spotterjs schema desktop_capture_screen
spotterjs run desktop_list_windows
```

不全局安装时，可用 `npx @spotterjs/cli` 代替 `spotterjs`。尚未发布的源码版本直接运行本地入口：

```bash
npm ci
npm run build:ts
node packages/cli/dist/cli.js list
node packages/cli/dist/cli.js run desktop_list_windows
```

修改 native binary 后需要 `npm run build:native`。桌面自动化要求 Windows 或 Linux
处于已登录、未锁定的交互桌面中。

## 安装 Agent Skill

包内包含 `skills/spotterjs/SKILL.md` 和命令参考。可以先查看路径，再复制到 Agent 的技能目录：

```powershell
spotterjs skill path
# Codex
spotterjs skill install --target "$env:USERPROFILE\.codex\skills"
# Claude Code
spotterjs skill install --target "$env:USERPROFILE\.claude\skills"
```

`--target` 接收技能父目录，安装器在其中创建 `spotterjs/`。源码运行时，把 `spotterjs`
替换成 `node packages/cli/dist/cli.js`。Skill 包含命令发现、schema 查询、观察—操作—验证、
JSON 输入、坐标和进程内会话的使用规则。
默认保留已有安装；确认要替换时，给安装命令添加 `--force`。

## JSON 参数和结果

执行前可以查询命令的实际字段：

```bash
spotterjs schema desktop_capture_screen
spotterjs run desktop_capture_screen --json '{"detail":"original"}'
spotterjs run desktop_capture_screen --file capture.json
```

`--json`、`--file`、`--stdin` 三选一；无参数命令可以全部省略。`--workspace` 指定
host 文件操作和截图 artifact 使用的工作区：

```bash
spotterjs --workspace ./test-output run host_list_dir
```

中文、emoji、多行、引号及 shell 特殊字符推荐使用 UTF-8 文件，避免命令行转义改变文本。
以下 PowerShell 示例精确保留文本：

```powershell
$payload = @{ text = "你好 😀 !@#`n第二行"; mode = 'native' } | ConvertTo-Json
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $PWD 'input.json'), $payload, $utf8)
spotterjs run desktop_keyboard_type --file input.json
```

UTF-8 shell 也可以通过 stdin 传参：

```bash
printf '%s' '{"detail":"original"}' | spotterjs run desktop_capture_screen --stdin
```

成功结果：

```json
{ "success": true, "data": { "imagePath": ".spotter/artifacts/example.png" } }
```

失败时退出码非零，结果为 `success: false`：

```json
{
  "success": false,
  "error": {
    "message": "ocr_find_text failed: OCR text not found: Send",
    "code": "SPOTTER_OCR_TEXT_NOT_FOUND",
    "domain": "ocr",
    "context": { "text": "Send", "exact": true }
  }
}
```

底层错误提供诊断时，返回 `code`、`domain` 和 `context`。点击或输入超时可能代表执行结果未知；
先观察实际界面，再决定是否重试。

## 发现可用命令

`list` 列出已启用命令及 schema，`list --all` 用于发现全部可选能力。执行可选命令前，
需要先启用对应能力：

- 桌面：`desktop_list_windows`、`desktop_list_apps`、`desktop_get_active_window`、
  `desktop_focus_window`、`desktop_capture_screen`、`desktop_capture_window`、
  `desktop_capture_active`、`desktop_mouse_*`、`desktop_keyboard_type`、
  `desktop_keyboard_tap`、`desktop_clipboard_*`。
- 视觉：`desktop_find_template`、`desktop_capture_and_ocr`、
  `desktop_capture_and_find_template`、`desktop_find_template_and_tap`，
  以及 `list` 中列出的图像和颜色命令。
- OCR：`ocr_read_image`、`ocr_find_text`。
- 无障碍（`SPOTTERJS_A11Y=1`）：优先使用 `desktop_a11y_inspect` 和
  `desktop_a11y_action`。底层 attach/find/dump/invoke 命令使用进程内 ID，
  适合在同一进程的 API 工作流中使用。
- Android（`SPOTTERJS_ANDROID=1`）：连接和设备列表、状态、应用启动、截图、触摸、输入、
  按键、无障碍树查询和模板匹配。具体字段用 `schema <command>` 查询。
- 录制（`SPOTTERJS_RECORDING=1`）：用 `desktop_record_input` 按固定时长录制并返回完成的脚本，
  用 `desktop_play_recording` 回放。底层 `desktop_start_recording`/`desktop_stop_recording`
  适合同一进程的 API 工作流；分开运行的 CLI 调用不会共享录制。
- 工作区：`host_read_file`、`host_write_file`、`host_list_dir`、`host_stat`、
  `host_open_file`、`host_shell_info`、`host_exec`。

## 推荐桌面流程

1. 列出窗口，确认目标应用和 window ID。
2. 聚焦目标，再截图或通过 OCR、模板匹配、无障碍树观察界面。
3. 对观察到的目标执行操作。
4. 再截图或读取状态，验证操作结果。

实时视觉检查可以用 `desktop_capture_and_ocr`、`desktop_capture_and_find_template`，
在同一张原始截图上完成识别。需要按模板点击时使用 `desktop_find_template_and_tap`，
只有匹配成功才点击。`debugImage: true` 会额外返回带标注的 PNG。
更多说明见[桌面自动化](./guides/desktop-automation.md)和 [OCR](./guides/ocr.md)。

## 无需传递进程内 ID 的无障碍操作

`desktop_a11y_inspect` 接收 `windowId`，以及可选的 `maxDepth`、`treeView` 和 `query`，
在一次调用中挂接并检查树，返回 `data.windowId`、`data.tree`，指定查询时还返回
`data.elementInfo`，树内容也限定到匹配元素的子树。`desktop_a11y_action` 接收 `windowId`、必填的非空 `query`、
可选 `maxDepth` 和 `action`，在同一进程中完成挂接、查找和操作。
先启用无障碍并查询 schema：

```powershell
$env:SPOTTERJS_A11Y = '1'
spotterjs schema desktop_a11y_inspect
spotterjs schema desktop_a11y_action
spotterjs run desktop_a11y_inspect --file inspect.json
```

`inspect.json` 中的窗口 ID 从 `desktop_list_windows` 取得：

```json
{ "windowId": "<观察到的窗口ID>", "maxDepth": 12 }
```

检查树后，可以为实际存在的搜索编辑框保存 `action.json`：

```json
{
  "windowId": "<观察到的窗口ID>",
  "query": { "controlType": "Edit", "nameContains": "搜索" },
  "action": { "type": "type", "text": "中文输入测试 😀" }
}
```

用目标窗口中的实际 ID 和搜索框 selector 替换示例值，再运行
`spotterjs run desktop_a11y_action --file action.json`，最后重新检查或截图验证。
`type` 通过无障碍 provider 设置所选元素的值。其他动作是
`{ "type": "click" }` 和 `{ "type": "invoke" }`。

查询支持 `name`、`nameContains`、`controlType`、`automationId`，以及可选的
`match: "exact" | "contains"`；多个字段按 AND 组合。应使用足够具体的 selector
定位目标控件。`desktop_a11y_attach_window`、`desktop_a11y_find`、
`desktop_a11y_invoke` 等底层命令保留 `rootId`/`elementId` 接口，适合在同一进程中编排。
CLI 退出后这些 ID 失效，sequence 的字面参数也不能传递前一步返回的 ID。
CLI 使用上述 inspect/action 命令；需要动态使用 ID 的流程，改用同一进程中的 TypeScript API。

## 在一次 CLI 调用中录制输入

`desktop_record_input` 启动录制、等待指定时长、停止，再返回 `data.script` 和
`data.scriptJson`：

```powershell
$env:SPOTTERJS_RECORDING = '1'
spotterjs schema desktop_record_input
spotterjs run desktop_record_input --json '{"durationMs":5000}'
```

`durationMs` 必填，范围为 1–300000 毫秒；`moveThrottleMs` 可选。
命令等待期间，由用户执行需要录制的输入。回放时，把返回的 `data.script` 放入 JSON 对象的
`script` 字段，可选设置 `speed`，再用
`spotterjs run desktop_play_recording --file playback.json` 执行。
先用 `schema desktop_play_recording` 查询字段；完整的录制响应对象不能直接作为回放参数。
分开的 start 和 stop CLI 调用不能共享录制状态。

## 截图 artifact 与坐标

截图 PNG 写入所选工作区的 `.spotter/artifacts`，`data.imagePath` 是工作区相对路径。
独立截图默认 `detail: "high"`，长边超过 1600 像素时缩小。OCR、小字和精确像素定位使用
`detail: "original"`。视觉组合命令和 Android 截图默认使用 `original`。

桌面视觉结果使用 `coordinateSpace: "screen"`，Android 使用
`coordinateSpace: "android-device"`。桌面窗口结果包含 `origin`，匹配和 OCR 坐标已经
换算到屏幕坐标。缩小后的预览图片坐标需要按原图尺寸还原并加截图原点，才能用作点击坐标。
`region` 只限制屏幕截图；`source: "window"` 要求 `windowId`，截取整个窗口。

## 序列和 Android 会话

有关联的操作使用 `spotterjs sequence --file plan.json`。文件是 1–100 个
`{ "name": "command_name", "arguments": {} }` 步骤组成的数组。执行前校验整段参数，
按顺序执行，遇到首个错误停止；已完成的 UI 动作不会回滚，也不会自动重放。
详见[序列编排](./guides/sequences.md)。

Android `deviceId` 缓存连接、无障碍和录制状态只属于当前进程。要复用设备 ID，
把 `android_connect` 和后续动作放在同一个 sequence 中；不同 CLI 调用之间，
每次动作需要传 `url` 和 `sessionToken`。配对得到的 token 可以用于后续认证重连，
请安全保存。详见 [Android companion](./guides/android-companion.md)。

## 环境变量和 host 边界

- `SPOTTERJS_WORKSPACE_ROOT`：工作区根目录，默认当前目录，也可以用 `--workspace` 指定。
- `SPOTTERJS_ALLOW_SHELL=1`：显式启用 `host_exec`，默认关闭。
- `SPOTTERJS_FS_MAX_BYTES`：文件读写和命令输出流大小限制，默认 1048576。
- `SPOTTERJS_EXEC_TIMEOUT_MS`：默认 shell 超时，默认 60000 毫秒。
- `SPOTTERJS_SHELL`：覆盖 host shell executable。
- `SPOTTERJS_A11Y`、`SPOTTERJS_ANDROID`、`SPOTTERJS_RECORDING`：设为 `1` 或 `true`
  启用对应可选能力。

Host 文件路径必须位于工作区内，`.env`、`credentials.json` 等敏感文件默认禁止写入。
用 `host_shell_info` 查询实际 shell。视觉输入图片路径按各命令的 schema 处理；
host 文件边界并不是限制桌面或 Android 操作的操作系统沙箱。

## 本地验证

```bash
npm run build:ts
npm run test -w @spotterjs/cli
npm run docs:check
node packages/cli/dist/cli.js list --all
node packages/cli/dist/cli.js run host_shell_info
node packages/cli/dist/cli.js run desktop_list_windows
```
