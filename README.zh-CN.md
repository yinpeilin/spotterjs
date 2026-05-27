# spotterjs

spotterjs 是一套 TypeScript-first 的跨平台桌面自动化工具集，使用 Rust native addon 提供截图、输入、窗口、无障碍和内置 NCC 模板匹配能力。

- Source: [GitHub - spotterjs/spotterjs](https://github.com/yinpeilin/spotterjs)
- npm: `@spotterjs/core` 及相关包
- 文档入口：[docs/README.md](docs/README.md)

## 安装

```bash
npm install @spotterjs/core
```

当前预构建 native 平台：

- Windows x64 (MSVC)
- Linux x64 (glibc)

## 快速开始

先跑这个脚本，确认 `@spotterjs/core` 能正常加载，也能读取屏幕和截图数据。

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

如果你已经准备好了按钮或图标截图，再用这个模板匹配示例测试点击：

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

`screen.find` 的模板可以是图片路径，也可以是 PNG / JPEG / WebP 编码后的 `Buffer`。匹配结果返回屏幕坐标。

## 能力矩阵

| 包 | 是否必需 | 职责 |
|----|----------|------|
| `@spotterjs/core` | 是 | 屏幕、鼠标、键盘、窗口、无障碍、模板匹配 |
| `@spotterjs/base` | 传递依赖 | 共享 TypeScript 类型 |
| `@spotterjs/node` | 传递依赖 | native loader：截图、输入、窗口、NCC 匹配 |
| `@spotterjs/node-win32-x64-msvc` | 可选 | Windows x64 native binary |
| `@spotterjs/node-linux-x64-gnu` | 可选 | Linux x64 glibc native binary |
| `@spotterjs/mcp` | 可选 | MCP Server：desktop、android、host 工具 |
| `@spotterjs/plugin-android-adb` | 可选 | Android ADB 自动化 |
| `@spotterjs/plugin-ocr` | 可选 | OCR 识别插件 |

## 文档地图

- [快速开始](docs/zh-CN/getting-started.md)：安装、首个脚本和本地验证。
- [桌面自动化](docs/zh-CN/guides/desktop-automation.md)：窗口、截图、键鼠、剪贴板和坐标。
- [模板匹配](docs/zh-CN/MATCHING.md)：NCC 匹配参数、Buffer needle 和性能。
- [无障碍自动化](docs/zh-CN/guides/accessibility.md)：UIA / AT-SPI、树 dump 和诊断。
- [MCP Server](docs/zh-CN/MCP.md)：MCP 客户端配置、工具列表和安全策略。
- [Android ADB](docs/zh-CN/guides/android-adb.md)：USB、无线调试、多设备和插件 API。
- [OCR 插件](docs/zh-CN/guides/ocr.md)：模型缓存、下载源、本地模型和测试。
- [示例地图](docs/zh-CN/examples.md)：Paint、Smoke、微信 integration 和 benchmark。
- [排障指南](docs/zh-CN/troubleshooting.md)：native、匹配、ADB、OCR、MCP 等常见问题。

维护者入口：

- [贡献指南](CONTRIBUTING.md)
- [架构说明](docs/zh-CN/development/architecture.md)
- [测试指南](docs/zh-CN/development/testing.md)
- [发布手册](docs/zh-CN/PUBLISHING.md)
- [文档规范](docs/zh-CN/development/documentation-style.md)

## 本地开发

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:ts
npm test
```

需要编译 native 包时：

```bash
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
npm run build:native
```

## 许可证

**spotterjs License 1.0**，详见 [LICENSE](LICENSE) 和 [中文说明](LICENSE.zh-CN)。

- 免费：个人学习、教学、非商业研究和本地评估。
- 商用：产品、SaaS、付费交付、企业生产等使用场景，需要先联系 `ypl123698745@qq.com` 或通过 [GitHub Issues](https://github.com/yinpeilin/spotterjs/issues) 获取授权。
