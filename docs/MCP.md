# spotterjs MCP Server

`@spotterjs/mcp` 把 spotterjs 的桌面自动化、工作区文件、OCR、无障碍和 Android 能力暴露给 MCP 客户端。

## 安装

```bash
npm install @spotterjs/mcp @spotterjs/core
```

开发时可从源码构建：

```bash
npm run build -w @spotterjs/node
npm run build -w @spotterjs/core
npm run build -w @spotterjs/mcp
```

直接启动：

```bash
npx -y @spotterjs/mcp
```

## 最小配置

对于支持 `mcpServers` 的客户端，最小配置如下：

```json
{
  "mcpServers": {
    "spotterjs": {
      "command": "npx",
      "args": ["-y", "@spotterjs/mcp"],
      "env": {
        "SPOTTERJS_WORKSPACE_ROOT": "C:/path/to/your/project"
      }
    }
  }
}
```

建议把 `SPOTTERJS_WORKSPACE_ROOT` 显式设置成你的项目根目录。这样 `host_*` 工具只会在这个工作区里读写文件。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SPOTTERJS_WORKSPACE_ROOT` | `process.cwd()` | `host_*` 工具的工作区根目录 |
| `SPOTTERJS_ALLOW_SHELL` | `0` | 设为 `1` 后启用 `host_exec` |
| `SPOTTERJS_A11Y` | `0` | 设为 `1` 后注册无障碍工具 |
| `SPOTTERJS_ANDROID_ADB` | `0` | 设为 `1` 后注册 Android 工具 |
| `SPOTTERJS_FS_MAX_BYTES` | `1048576` | 单次文件读写上限 |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | `60000` | shell 默认超时 |
| `SPOTTERJS_SHELL` | 自动检测 | 覆盖 shell 可执行文件 |

## 工具分组

### Desktop

- `desktop_list_windows`
- `desktop_list_apps`
- `desktop_get_active_window`
- `desktop_capture_screen`
- `desktop_capture_window`
- `desktop_capture_active`
- `desktop_focus_window`
- `desktop_mouse_move`
- `desktop_mouse_click`
- `desktop_mouse_tap`
- `desktop_keyboard_type`
- `desktop_clipboard_get`
- `desktop_clipboard_set`
- `desktop_find_template`

`desktop_find_template` 支持模板路径或 base64 图片：

```json
{
  "image": { "path": "C:/path/to/button.png" },
  "confidence": 0.9,
  "region": { "left": 100, "top": 50, "width": 800, "height": 600 },
  "scale": true,
  "all": true
}
```

启用 `SPOTTERJS_A11Y=1` 后还会出现：

- `desktop_a11y_attach_window`
- `desktop_a11y_find`
- `desktop_a11y_invoke`
- `desktop_a11y_tap_element`
- `desktop_a11y_dump_tree`
- `desktop_a11y_element_info`

### Android

启用 `SPOTTERJS_ANDROID_ADB=1` 后会出现：

- `android_discover_devices`
- `android_pair_tcp`
- `android_connect_network`
- `android_connect_default`
- `android_connect_all`
- `android_capture_screen`
- `android_batch_tap`
- `android_batch_swipe`
- `android_batch_capture`
- `android_tap`
- `android_swipe`
- `android_type_text`
- `android_keyevent`
- `android_back`
- `android_home`
- `android_start_app`
- `android_stop_app`
- `android_dump_tree`
- `android_find_element`
- `android_wait_for_element`
- `android_tap_element`
- `android_type_element`
- `android_shell`
- `android_get_display_info`
- `android_wake`
- `android_sleep`
- `android_current_app`
- `android_clear_app`
- `android_find_template`

Android 工具要求 `adb` 可用，或在工具调用里传入 `adbPath`。无线调试需要先完成 Android 11+ 的配对步骤。

### Host

- `host_read_file`
- `host_write_file`
- `host_list_dir`
- `host_stat`
- `host_open_file`
- `host_shell_info`
- `host_exec`

`host_exec` 默认关闭。启用后可以这样调用：

```json
{
  "command": "npm run docs:check",
  "cwd": ".",
  "timeoutMs": 60000
}
```

### OCR

- `ocr_read_image`
- `ocr_find_text`

OCR 工具通常接收截图工具返回的 `imagePath`：

```json
{
  "imagePath": ".spotterjs/artifacts/capture-001.png",
  "text": "Submit",
  "exact": false
}
```

## 客户端配置

### 通用 stdio

只要客户端支持 stdio / `mcpServers`，就可以直接复用上面的最小配置。

### Cursor

Cursor 会读取 MCP 配置文件，通常把同样的 server 配置放进它的 MCP 设置里即可。推荐做法是使用项目级或用户级 `mcp.json`，然后重启或重新加载 MCP 配置。

### Claude Desktop

在 `claude_desktop_config.json` 里加入同样的 `mcpServers` 片段。编辑后从 Developer 菜单重载 MCP 配置，或者直接重启应用。

### Claude Code

Claude Code 支持通过 CLI 管理 MCP。对本仓库这个本地 stdio server，推荐用：

```bash
claude mcp add --transport stdio --env SPOTTERJS_WORKSPACE_ROOT=C:/path/to/your/project spotterjs -- npx -y @spotterjs/mcp
claude mcp list
```

如果你想把它放到整个用户范围，也可以在 add 时带上 `--scope user`。

### VS Code / Copilot

VS Code 的 `mcp.json` 使用 `servers` 字段。工作区级配置放在 `.vscode/mcp.json`，用户级配置可以通过命令面板里的 `MCP: Open User Configuration` 打开。

```json
{
  "servers": {
    "spotterjs": {
      "command": "npx",
      "args": ["-y", "@spotterjs/mcp"],
      "env": {
        "SPOTTERJS_WORKSPACE_ROOT": "C:/path/to/your/project"
      }
    }
  }
}
```

### Windsurf

Windsurf 会读取 `~/.codeium/windsurf/mcp_config.json`，也可以在 `Windsurf Settings > Cascade > MCP Servers` 里添加。对本仓库来说，直接用同样的 `command` / `args` / `env` 即可。

### Cline

Cline 的 MCP 面板可以直接添加本地 server，也可以编辑 `~/.cline/mcp.json`。它还支持 CLI wizard，适合快速验证本地 stdio server。

### Codex

Codex CLI / IDE 共用 MCP 配置。优先用 `codex mcp add` 把 server 加进去：

```bash
codex mcp add spotterjs --env SPOTTERJS_WORKSPACE_ROOT=C:/path/to/your/project -- npx -y @spotterjs/mcp
```

也可以直接编辑 `~/.codex/config.toml` 或项目级 `.codex/config.toml`：

```toml
[mcp_servers.spotterjs]
command = "npx"
args = ["-y", "@spotterjs/mcp"]

[mcp_servers.spotterjs.env]
SPOTTERJS_WORKSPACE_ROOT = "C:/path/to/your/project"
```

## 验证

推荐按这个顺序验证：

1. 先启动 server
2. 再确认客户端能列出工具
3. 再调用只读工具
4. 最后才启用 shell、无障碍或 Android

MCP Inspector：

```bash
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

最小验证工具：

- `host_shell_info`
- `desktop_list_apps`
- `desktop_capture_screen`

启用额外能力后再测：

- `desktop_a11y_dump_tree`
- `android_discover_devices`

## 安全策略

- `host_exec` 默认关闭
- `host_*` 只能访问 `SPOTTERJS_WORKSPACE_ROOT`
- 默认不会开启无障碍和 Android
- 不要把真实密钥直接写进配置文件，优先放环境变量
- 确认你允许 MCP 客户端控制当前机器的鼠标、键盘和窗口后，再启用桌面工具

## 排障

### 看不到工具

- 检查 server 是否启动成功
- 检查配置文件路径是否正确
- 检查客户端是否重新加载了配置
- 检查 `SPOTTERJS_A11Y` 和 `SPOTTERJS_ANDROID_ADB` 是否真的打开了

### 文件工具失败

- 检查工作区根目录是否设置正确
- 检查路径是否在工作区内
- 检查是不是在写受保护文件

### shell 不可用

- 确认 `SPOTTERJS_ALLOW_SHELL=1`
- 确认当前客户端重新拉起了 server
- 先用 `host_shell_info` 看实际 shell

### Android 工具不可用

- 确认 `adb` 已安装并在 PATH 中
- 确认 USB 授权或无线调试已经配对
- 确认 `SPOTTERJS_ANDROID_ADB=1`

### 无障碍工具不可用

- 确认 `SPOTTERJS_A11Y=1`
- 确认目标窗口是前台且可访问
- 先用 `desktop_list_windows` 和 `desktop_get_active_window` 看窗口状态

## 参考

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Cursor MCP](https://docs.cursor.com/en/context/mcp)
- [VS Code MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Windsurf MCP](https://docs.windsurf.com/windsurf/cascade/mcp)
- [Cline MCP](https://docs.cline.bot/mcp/mcp-overview)
- Codex MCP 官方文档：`https://developers.openai.com/codex/mcp`
