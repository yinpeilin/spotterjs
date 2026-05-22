# spotterjs MCP Server (`@spotterjs/mcp`)

The spotterjs MCP server exposes desktop automation, workspace file access, and shell execution to MCP clients (Cursor, Claude Desktop, etc.).

## Install

```bash
npm install @spotterjs/mcp @spotterjs/core
```

Build from source (development):

```bash
npm run build -w @spotterjs/node
npm run build -w @spotterjs/core
npm run build -w @spotterjs/mcp
```

## Cursor / Claude configuration

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

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTTERJS_WORKSPACE_ROOT` | `process.cwd()` | Sandbox root for `host_*` file tools |
| `SPOTTERJS_ALLOW_SHELL` | `0` | Set to `1` to enable `host_exec` |
| `SPOTTERJS_FS_MAX_BYTES` | `1048576` | Max read/write size per file |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | `60000` | Shell command timeout |
| `SPOTTERJS_SHELL` | *(auto)* | Override shell executable |
| `SPOTTERJS_A11Y` | off | Set to `1` to register accessibility tools |

### Shell platform policy

`host_exec` does **not** require you to pick a shell:

| OS | Shell | Example command |
|----|-------|-----------------|
| Windows | PowerShell | `Get-Location` |
| Linux / macOS | bash | `pwd` |

Use `host_shell_info` to query the active shell and syntax hint.

## Tools

### Desktop (`desktop_*`)

| Tool | Description |
|------|-------------|
| `desktop_list_windows` | Visible windows with PID / process name |
| `desktop_list_apps` | Apps aggregated by process |
| `desktop_get_active_window` | Foreground window |
| `desktop_capture_screen` | PNG base64 (optional region) |
| `desktop_capture_window` | Capture by window id |
| `desktop_capture_active` | Capture foreground window |
| `desktop_focus_window` | Focus window |
| `desktop_mouse_move` / `desktop_mouse_click` / `desktop_mouse_tap` | Mouse input |
| `desktop_keyboard_type` | Type text |
| `desktop_clipboard_get` / `desktop_clipboard_set` | Clipboard |
| `desktop_find_template` | Template match on screen |

With `SPOTTERJS_A11Y=1`:

| Tool | Description |
|------|-------------|
| `desktop_a11y_attach_window` | Attach UIA / AT-SPI tree (returns HWND candidates + diagnosis) |
| `desktop_a11y_find` | Find element |
| `desktop_a11y_invoke` | Invoke pattern |
| `desktop_a11y_tap_element` | Click element center |
| `desktop_a11y_dump_tree` | Dump accessibility tree (`treeView`: auto/raw/control/content) |
| `desktop_a11y_element_info` | Single element metadata (patterns, runtimeId, etc.) |

### Host (`host_*`)

| Tool | Description |
|------|-------------|
| `host_read_file` | Read text file in workspace |
| `host_write_file` | Write text file in workspace |
| `host_list_dir` | List directory |
| `host_stat` | File metadata |
| `host_open_file` | Open with OS default app |
| `host_shell_info` | Current shell + syntax hint |
| `host_exec` | Run command (requires `SPOTTERJS_ALLOW_SHELL=1`) |

## Security

- File paths must resolve **inside** `SPOTTERJS_WORKSPACE_ROOT`.
- Writing to `.env`, `credentials.json`, etc. is blocked by default.
- Shell execution is **disabled** unless `SPOTTERJS_ALLOW_SHELL=1`.
- Desktop tools can control your mouse, keyboard, and windows — enable only on trusted machines.

## Smoke test

```bash
npm run smoke:desktop
```

## MCP Inspector (manual)

```bash
npx @modelcontextprotocol/inspector npx @spotterjs/mcp
```

Verify: `host_shell_info`, `desktop_list_apps`, `host_read_file` (with workspace root set).
