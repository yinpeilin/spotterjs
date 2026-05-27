# 架构说明

spotterjs 是一个 TypeScript + Rust monorepo。TypeScript 包负责用户 API、MCP 和插件入口，Rust crate 负责平台能力、图像处理和 native binding。

## 工作区结构

| 路径 | 职责 |
|------|------|
| `packages/core` | 用户主入口，封装桌面自动化高层 API |
| `packages/base` | 共享 TypeScript 类型 |
| `packages/mcp` | MCP Server，暴露 desktop / android / host 工具 |
| `packages/plugin-ocr` | OCR 插件，ONNX 模型下载和识别流程 |
| `packages/plugin-android-adb` | Android ADB 自动化插件 |
| `crates/spotterjs-base` | Rust 共享类型、错误和 N-API 转换 |
| `crates/spotterjs-core` | Rust 平台能力：截图、输入、窗口、无障碍、图像 |
| `crates/spotterjs-node` | Node native loader 和 N-API binding |
| `crates/spotterjs-plugin-match-ncc` | NCC 模板匹配实现 |
| `scripts` | Smoke、integration、发布辅助和维护脚本 |
| `examples` | 可运行示例 |

## 核心调用链

```text
@spotterjs/core
  -> @spotterjs/node
    -> spotterjs-core
      -> spotterjs-base
      -> spotterjs-plugin-match-ncc
```

模板匹配统一经过 `@spotterjs/node` 和 Rust NCC 实现。仓库不再维护单独的 OpenCV 匹配插件路径。

## TypeScript 包边界

- `@spotterjs/core` 是桌面自动化主入口，用户脚本应优先从这里导入。
- `@spotterjs/base` 只放共享类型，避免引入 native 加载副作用。
- `@spotterjs/mcp` 负责把核心能力适配成 MCP tool schema，不改变 core API。
- 插件包只暴露自己的领域能力，不把内部解析、路径发现、命令 escaping helper 当作稳定 API。

## Rust crate 边界

- `spotterjs-base` 放跨 crate 共享类型和转换。
- `spotterjs-core` 放平台实现和可复用 native 能力。
- `spotterjs-node` 负责 N-API 出口和平台 binary packaging。
- `spotterjs-plugin-match-ncc` 专注匹配算法，不感知 TypeScript API 形状。

## native optional package

`@spotterjs/node` 是 JS loader。平台二进制通过 optional package 分发：

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

发布时先发布平台包，再发布 `@spotterjs/node`，最后发布依赖它的 TypeScript 包。详细流程见 [发布手册](../PUBLISHING.md)。

## MCP 边界

MCP Server 暴露三类工具：

- desktop：桌面截图、输入、窗口、模板匹配、可选无障碍。
- android：启用 `SPOTTERJS_ANDROID_ADB=1` 后注册 ADB 工具。
- host：工作区文件、打开文件和可选 shell。

MCP 的安全边界在 server 层处理：文件必须在 workspace root 内，shell 默认关闭，敏感文件写入默认禁止。

## 设计原则

- 用户优先使用高层 API，`@spotterjs/core/unstable-native` 的 `loadNative()` 只作为不稳定逃生舱。
- 文档中的包 README 保持短入口，深度内容放在 `docs/`。
- 新增平台能力时，同时补 TypeScript API、MCP 行为、测试和文档。
