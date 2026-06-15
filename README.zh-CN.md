# spotterjs

[English](./README.md)

spotterjs 是 TypeScript-first 的桌面自动化工具集，底层由 Rust native
addons 支撑。它提供屏幕截图、鼠标和键盘输入、窗口发现、无障碍自动化、
NCC 模板匹配、OCR、Android companion 自动化，以及面向代码 Agent 的
MCP server。

- 源码：[GitHub repository](https://github.com/yinpeilin/spotterjs)
- npm 包：`@spotterjs/core` 和可选插件
- 文档：[English](./docs/en/README.md) / [中文](./docs/zh-CN/README.md)

## 适用场景

spotterjs 适合把「看屏幕、找目标、点按钮、输入文本、读状态」这类人工操作写成
TypeScript 脚本，或通过 MCP 暴露给代码 Agent 使用。

- **桌面应用自动化：** 对 Windows / Linux 桌面应用做冒烟测试、重复配置、截图取证、窗口聚焦和键鼠输入。
- **视觉定位和 OCR：** 目标应用没有稳定 API 时，用模板匹配、OCR 或无障碍树定位按钮、图标和文本。
- **Agent 驱动的本机操作：** 在 Cursor、Claude Desktop 等 MCP client 中，让 Agent 读取工作区文件、观察桌面、执行安全范围内的操作。
- **Android companion 自动化：** 在电脑端写 TypeScript 或 MCP 调用，通过 WebSocket 控制一台或多台 Android 设备。
- **跨设备流程验证：** 把桌面端配置、网页后台、手机端 App、短信或消息确认串成一个自动化闭环。

如果你的目标是「电脑端写代码操作多台设备」，推荐使用 MCP 的
`android_connect` 为每台手机分配不同 `deviceId`，再用 `android_list_devices`
查看缓存连接，用 `android_launch_app`、`android_wait_for_element`、
`android_find_template_and_tap` 等工具分别操作每台设备。

## 安装

```bash
npm install @spotterjs/core
```

当前预构建 native 包支持：

- Windows x64 (MSVC)
- Linux x64 (glibc)

## 快速开始

创建 `check-spotter.ts`：

```typescript
import { screen } from "@spotterjs/core";

const size = screen.size();
const capture = screen.capture({
  left: 0,
  top: 0,
  width: Math.min(200, size.width),
  height: Math.min(200, size.height),
});

console.log({
  screen: size,
  capture: {
    width: capture.width,
    height: capture.height,
    bytes: capture.data.length,
  },
});
```

运行：

```bash
npx tsx check-spotter.ts
```

验证截图能力后，可以用模板匹配点击可见按钮或图标：

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

`screen.find` 接受图片路径，或编码后的 PNG/JPEG/WebP `Buffer`。匹配结果使用屏幕坐标。

## 包矩阵

| Package | 是否必需 | 用途 |
|---------|----------|------|
| `@spotterjs/core` | 是 | 屏幕、鼠标、键盘、窗口、无障碍、host I/O 和模板匹配 |
| `@spotterjs/base` | 传递依赖 | 共享 TypeScript 类型 |
| `@spotterjs/node` | 传递依赖 | capture、input、windows、accessibility、image 和 NCC matching 的 native loader |
| `@spotterjs/node-win32-x64-msvc` | 可选 | Windows x64 native binary |
| `@spotterjs/node-linux-x64-gnu` | 可选 | Linux x64 glibc native binary |
| `@spotterjs/mcp` | 可选 | 面向 desktop、Android、OCR 和 workspace tools 的 MCP server |
| `@spotterjs/plugin-android` | 可选 | 通过 mobile companion app 实现 Android 自动化 |
| `@spotterjs/plugin-ocr` | 可选 | 基于 ONNX Runtime 的 OCR |

## 文档地图

- [快速开始](./docs/zh-CN/getting-started.md)：安装、第一个脚本和本地验证。
- [桌面自动化](./docs/zh-CN/guides/desktop-automation.md)：窗口、截图、输入、剪贴板和坐标。
- [模板匹配](./docs/zh-CN/MATCHING.md)：NCC 参数、编码 Buffer、region 和性能。
- [无障碍自动化](./docs/zh-CN/guides/accessibility.md)：UIA / AT-SPI 树、查询和诊断。
- [MCP Server](./docs/zh-CN/MCP.md)：client 配置、tools、响应结构和安全策略。
- [Android companion](./docs/zh-CN/guides/android-companion.md)：WebSocket 配对、session 复用、设备输入和 accessibility tree API。
- [OCR 插件](./docs/zh-CN/guides/ocr.md)：模型缓存、下载源、本地模型、坐标和测试。
- [示例](./docs/zh-CN/examples.md)：Paint 示例、smoke 脚本、集成脚本和 benchmark。
- [排障指南](./docs/zh-CN/troubleshooting.md)：native 加载、匹配、Android companion、OCR 和 MCP 问题。

维护者文档：

- [架构](./docs/zh-CN/development/architecture.md)
- [测试](./docs/zh-CN/development/testing.md)
- [发布](./docs/zh-CN/PUBLISHING.md)
- [文档规范](./docs/zh-CN/development/documentation-style.md)
- [清理与架构说明](./docs/zh-CN/CLEANUP-AND-ARCHITECTURE.md)

## 本地开发

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:ts
npm test
```

修改 Rust 或 N-API 代码时，需要构建 native 包：

```bash
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
npm run build:native
```

## 许可证

**spotterjs License 1.0**。详见 [LICENSE](./LICENSE) 和
[中文说明](./LICENSE.zh-CN)。

- 免费使用：个人学习、教学、非商业研究和本地评估。
- 商业使用：产品、SaaS、付费交付、企业生产等场景需要授权。请联系
  `ypl123698745@qq.com` 或提交 GitHub issue。
