# 文档规范

spotterjs 文档中文为主，保留包名、API、命令、协议和行业通用术语的英文原文。目标是让用户能快速跑通，也让维护者能稳定更新。

## 信息分层

| 文档位置 | 职责 |
|----------|------|
| 根 `README.md` | 项目定位、安装、最小示例、能力矩阵、文档地图、许可证 |
| `docs/README.md` | 全量文档导航 |
| 包 README | npm 页面入口，保留安装、最小示例、核心 API 表和深度链接 |
| `docs/guides/` | 用户任务导向指南 |
| `docs/development/` | 维护者、架构、测试、发布和文档规范 |
| `docs/troubleshooting.md` | 跨模块常见问题 |

长解释优先放在 `docs/`，包 README 只保留足够判断是否安装和如何开始的信息。

## 中文排版

- 中文和英文之间加空格，例如：`使用 TypeScript API 控制桌面`。
- 中文和数字之间加空格，例如：`支持 2 个平台包`。
- 中文语境使用全角标点；代码、命令和英文句子使用半角标点。
- 命令、路径、环境变量、包名和 API 使用反引号。
- 句子尽量短，一段只解释一个主题。

## 术语

保留英文：

- 包名：`@spotterjs/core`
- API：`screen.find`、`windows.findTemplate`、`loadNative()`
- 协议和格式：HTTP、JSON、MCP、N-API
- 工具名：Node.js、Rust、ADB、ONNX Runtime

可翻译：

- guide：指南。
- troubleshooting：排障。
- workspace：工作区。
- optional package：可选平台包。

首次出现复杂概念时可以中英对照，例如：归一化互相关（Normalized Cross-Correlation，NCC）。

## 示例代码

- 示例必须能直接复制运行，除非明确标注为片段。
- 代码块标注语言：`typescript`、`bash`、`powershell`、`json`、`text`。
- 会操作真实桌面、设备或应用的示例必须写清风险。
- 环境变量按平台区分，Windows 示例优先使用 PowerShell。

## 链接

- 本地链接使用相对路径。
- 从包 README 链到根文档时，确认相对层级正确。
- 移动、新增或编辑文档后运行 `npm run docs:check`。
- `docs:check` 会拒绝无效 UTF-8，并检查本地 Markdown 链接。
- 外链只放稳定来源，避免把临时讨论链接写进正式文档。

## 更新检查清单

- [ ] 新增能力是否出现在对应指南或包 README 中。
- [ ] 公开 API 是否有最小示例。
- [ ] MCP tool 变化是否同步到 `docs/en/MCP.md` 和 `docs/zh-CN/MCP.md`。
- [ ] 脚本变化是否同步到 [示例地图](../examples.md) 或 [测试指南](./testing.md)。
- [ ] Markdown 文件是否是有效 UTF-8，且没有替换字符。
- [ ] 本地相对链接是否通过 `npm run docs:check`。
