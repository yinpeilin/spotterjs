# Spotter MCP Server (`@spotter/mcp`)

The Spotter MCP server exposes desktop automation, workspace file access, and shell execution to MCP clients (Cursor, Claude Desktop, etc.).

## Install

```bash
npm install @spotter/mcp @spotter/core
```

Build from source (development):

```bash
npm run build -w @spotter-rs/node
npm run build -w @spotter/core
npm run build -w @spotter/mcp
```

## Cursor / Claude configuration

```json
{
  "mcpServers": {
    "spotter": {
      "command": "npx",
      "args": ["-y", "@spotter/mcp"],
      "env": {
        "SPOTTER_WORKSPACE_ROOT": "C:/path/to/your/project",
        "SPOTTER_ALLOW_SHELL": "1",
        "SPOTTER_A11Y": "1"
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPOTTER_WORKSPACE_ROOT` | `process.cwd()` | Sandbox root for `host_*` file tools |
| `SPOTTER_ALLOW_SHELL` | `0` | Set to `1` to enable `host_exec` |
| `SPOTTER_FS_MAX_BYTES` | `1048576` | Max read/write size per file |
| `SPOTTER_EXEC_TIMEOUT_MS` | `60000` | Shell command timeout |
| `SPOTTER_SHELL` | *(auto)* | Override shell executable |
| `SPOTTER_A11Y` | off | Set to `1` to register accessibility tools |

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

With `SPOTTER_A11Y=1`:

| Tool | Description |
|------|-------------|
| `desktop_a11y_attach_window` | Attach UIA / AT-SPI tree |
| `desktop_a11y_find` | Find element |
| `desktop_a11y_invoke` | Invoke pattern |
| `desktop_a11y_tap_element` | Click element center |
| `desktop_a11y_dump_tree` | Dump accessibility tree |

### Host (`host_*`)

| Tool | Description |
|------|-------------|
| `host_read_file` | Read text file in workspace |
| `host_write_file` | Write text file in workspace |
| `host_list_dir` | List directory |
| `host_stat` | File metadata |
| `host_open_file` | Open with OS default app |
| `host_shell_info` | Current shell + syntax hint |
| `host_exec` | Run command (requires `SPOTTER_ALLOW_SHELL=1`) |

## Security

- File paths must resolve **inside** `SPOTTER_WORKSPACE_ROOT`.
- Writing to `.env`, `credentials.json`, etc. is blocked by default.
- Shell execution is **disabled** unless `SPOTTER_ALLOW_SHELL=1`.
- Desktop tools can control your mouse, keyboard, and windows — enable only on trusted machines.

## Smoke test

```bash
npm run smoke:desktop
```

## MCP Inspector (manual)

```bash
npx @modelcontextprotocol/inspector npx @spotter/mcp
```

Verify: `host_shell_info`, `desktop_list_apps`, `host_read_file` (with workspace root set).
