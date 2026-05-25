# @spotterjs/mcp

spotterjs MCP Server，把桌面自动化、可选 Android ADB 自动化、workspace 文件 I/O 和 shell 执行暴露给 MCP 客户端。

## 安装

```bash
npm install @spotterjs/mcp @spotterjs/core
```

源码开发：

```bash
npm run build -w @spotterjs/mcp
npx spotterjs-mcp
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

启用 shell 或 Android 工具时，再显式设置：

```json
{
  "SPOTTERJS_ALLOW_SHELL": "1",
  "SPOTTERJS_ANDROID_ADB": "1",
  "SPOTTERJS_A11Y": "1"
}
```

完整配置、工具列表和安全策略见 [docs/MCP.md](../../docs/MCP.md)。
