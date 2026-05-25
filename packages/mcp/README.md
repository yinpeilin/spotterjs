# @spotterjs/mcp

spotterjs MCP Server。它把桌面自动化、工作区文件、OCR、无障碍和 Android ADB 暴露给支持 MCP 的客户端。

## 安装

```bash
npm install @spotterjs/mcp @spotterjs/core
```

## 运行

```bash
npx -y @spotterjs/mcp
```

从源码开发时：

```bash
npm run build -w @spotterjs/mcp
npm run start -w @spotterjs/mcp
```

## 最小配置

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

常用开关：

- `SPOTTERJS_ALLOW_SHELL=1`
- `SPOTTERJS_A11Y=1`
- `SPOTTERJS_ANDROID_ADB=1`

## 环境变量

| 变量 | 说明 |
|------|------|
| `SPOTTERJS_WORKSPACE_ROOT` | 工作区根目录 |
| `SPOTTERJS_ALLOW_SHELL` | 启用 `host_exec` |
| `SPOTTERJS_A11Y` | 启用无障碍工具 |
| `SPOTTERJS_ANDROID_ADB` | 启用 Android 工具 |
| `SPOTTERJS_FS_MAX_BYTES` | 文件读写上限 |
| `SPOTTERJS_EXEC_TIMEOUT_MS` | shell 超时 |

## 工具

默认暴露：

- `desktop_*`
- `host_*`
- `ocr_*`

可选暴露：

- `desktop_a11y_*`
- `android_*`

## 文档

完整配置、客户端示例和安全策略见 [docs/MCP.md](../../docs/MCP.md)。
