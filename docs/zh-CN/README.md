# spotterjs 文档

spotterjs 是面向桌面自动化的 TypeScript-first 工具集，底层使用 Rust native addon 提供截图、输入、窗口、无障碍和 NCC 模板匹配能力。

## 快速上手

- [快速开始](./getting-started.md)：安装、环境要求、第一个脚本和本地验证命令。
- [示例地图](./examples.md)：Paint 示例、Smoke 脚本、微信集成脚本和输出目录。
- [排障指南](./troubleshooting.md)：native 包、ADB、OCR、模板匹配、无障碍和文档链接检查的常见问题。

## 核心指南

- [桌面自动化](./guides/desktop-automation.md)：窗口、截图、键鼠、剪贴板、坐标空间和匹配点击。
- [无障碍自动化](./guides/accessibility.md)：UIA / AT-SPI、树 dump、查询、点击和诊断。
- [模板匹配](./MATCHING.md)：NCC 匹配架构、参数、Buffer needle、search region 和性能数据。

## 集成能力

- [MCP Server](./MCP.md)：MCP 配置、desktop / android / host 工具和安全策略。
- [Android ADB 自动化](./guides/android-adb.md)：USB、无线调试、多设备和插件 API。
- [OCR 插件](./guides/ocr.md)：模型下载、缓存、坐标、私有模型和集成测试。

## API 入口

- [`@spotterjs/core`](../../packages/core/README.md)：核心桌面自动化 API。
- [`@spotterjs/mcp`](../../packages/mcp/README.md)：MCP server 包入口。
- [`@spotterjs/plugin-android-adb`](../../packages/plugin-android-adb/README.md)：Android ADB 插件入口。
- [`@spotterjs/plugin-ocr`](../../packages/plugin-ocr/README.md)：OCR 插件入口。

## 维护者

- [架构说明](./development/architecture.md)：monorepo、TypeScript 包、Rust crate、native 包和插件边界。
- [测试指南](./development/testing.md)：单元测试、Rust 测试、Smoke、integration 和平台测试。
- [文档规范](./development/documentation-style.md)：中文排版、术语、示例、链接和 README 分层。
- [发布手册](./PUBLISHING.md)：changeset、license sync、native optional package 和 npm 发布顺序。
- [清理与架构说明](./CLEANUP-AND-ARCHITECTURE.md)：当前仓库清理范围与架构说明。

## 维护命令

```bash
npm run docs:check
npm run build:ts
```

`docs:check` 只检查本地 Markdown 相对链接。外链、邮箱链接和锚点-only 链接会被忽略。
