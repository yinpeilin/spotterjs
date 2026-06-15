# spotterjs 文档

[English](../en/README.md)

spotterjs 是面向桌面和 Android companion 自动化的 TypeScript-first 工具集。
写脚本、构建 MCP tools 或维护仓库时，可以从这里进入对应文档。

## 可以用来做什么

- **桌面重复操作自动化：** 自动打开应用、聚焦窗口、截图、点击、输入、读剪贴板，适合冒烟测试、数据录入和批量配置。
- **没有 API 的界面自动化：** 通过 OCR、NCC 模板匹配和无障碍树识别界面元素，再用坐标或元素中心点操作。
- **代码 Agent 的眼睛和手：** 通过 MCP Server 让 Agent 观察桌面、读写工作区文件、调用受控 shell，并把截图 artifact 留在仓库内复查。
- **Android 真机编排：** 在电脑端用 TypeScript 或 MCP 连接 companion app，控制多台 Android 设备执行安装后验证、账号流程、跨端消息确认等任务。
- **跨端业务闭环：** 把桌面后台、浏览器、Windows 应用、Android App 和 OCR 检查组合成端到端脚本。

多设备场景建议从 [Android companion 自动化](./guides/android-companion.md#从电脑端控制多台设备)
和 [MCP Server 的 Android 工具](./MCP.md#android-多设备编排) 开始。

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
