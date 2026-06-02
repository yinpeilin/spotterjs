# spotterjs 文档

[English](../en/README.md)

spotterjs 是面向桌面和 Android companion 自动化的 TypeScript-first 工具集。
写脚本、构建 MCP tools 或维护仓库时，可以从这里进入对应文档。

## 快速上手

- [快速开始](./getting-started.md)：安装包、运行第一个脚本，并验证本地环境。
- [示例](./examples.md)：Paint 示例、smoke 脚本、微信集成脚本和 benchmark 命令。
- [排障指南](./troubleshooting.md)：native、匹配、Android companion、OCR、MCP 和文档问题。

## 指南

- [桌面自动化](./guides/desktop-automation.md)：窗口、截图、输入、剪贴板、坐标空间和点击点。
- [无障碍自动化](./guides/accessibility.md)：UIA / AT-SPI 树、元素查询、动作和诊断。
- [模板匹配](./MATCHING.md)：NCC 匹配架构、参数、编码 Buffer、search region 和限制。

## 集成能力

- [MCP Server](./MCP.md)：MCP client 配置、desktop / Android / OCR / host tools、响应结构和安全策略。
- [Android companion 自动化](./guides/android-companion.md)：WebSocket 配对、session 复用、设备输入和 accessibility tree。
- [OCR 插件](./guides/ocr.md)：模型下载、缓存目录、本地模型、坐标和集成测试。

## API 入口

- [`@spotterjs/core`](../../packages/core/README.md)：桌面自动化 API。
- [`@spotterjs/mcp`](../../packages/mcp/README.md)：MCP server 包。
- [`@spotterjs/plugin-android`](../../packages/plugin-android/README.md)：Android companion 插件。
- [`@spotterjs/plugin-ocr`](../../packages/plugin-ocr/README.md)：OCR 插件。

## 维护者

- [架构](./development/architecture.md)：monorepo 布局、TypeScript packages、Rust crates、native packages 和边界。
- [测试](./development/testing.md)：unit tests、Rust tests、smoke tests、integration scripts、benchmarks 和 packaging checks。
- [文档规范](./development/documentation-style.md)：双语文档策略、API 注释、示例和链接。
- [发布](./PUBLISHING.md)：changesets、license sync、native optional packages 和 npm 发布顺序。
- [清理与架构说明](./CLEANUP-AND-ARCHITECTURE.md)：当前仓库清理范围和架构说明。

## 维护命令

```bash
npm run docs:check
npm run build:ts
```

`docs:check` 会验证 Markdown 文件是否是有效 UTF-8，并检查两套语言树里的本地链接。
外链、mail 链接和只含 anchor 的链接会被忽略。
