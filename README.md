# spotterjs

spotterjs 是一套 TypeScript-first 的跨平台桌面自动化工具集，底层通过 Rust native addon 提供截图、输入、窗口、无障碍、模板匹配和 MCP 能力。

- Source: [Gitee - spotterjs/spotterjs](https://gitee.com/ypl0lpy/spotterjs)
- npm: `@spotterjs/core` 及相关包
- 文档入口: [docs/README.md](docs/README.md)

## 安装

```bash
npm install @spotterjs/core
```

当前预构建 native 平台：

- Windows x64 (MSVC)
- Linux x64 (glibc)

## 最小示例

```typescript
import { keyboard, mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
keyboard.write("hello from spotterjs");
```

`screen.find` 的模板可以是图片路径，也可以是 PNG / JPEG / WebP 编码后的 `Buffer`。

## 能力矩阵

| 包 | 职责 |
|----|------|
| `@spotterjs/core` | 桌面自动化主入口：屏幕、鼠标、键盘、窗口、无障碍、模板匹配 |
| `@spotterjs/base` | 共享 TypeScript 类型与工具 |
| `@spotterjs/node` | native loader：截图、输入、窗口、NCC 匹配 |
| `@spotterjs/mcp` | MCP Server：桌面、文件、OCR、可选无障碍与 Android 工具 |
| `@spotterjs/plugin-android-adb` | Android ADB 自动化 |
| `@spotterjs/plugin-ocr` | OCR 识别 |

## MCP 快速配置

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

默认只启用桌面、文件和 OCR 工具。需要时再加：

- `SPOTTERJS_ALLOW_SHELL=1` 启用 `host_exec`
- `SPOTTERJS_A11Y=1` 启用无障碍工具
- `SPOTTERJS_ANDROID_ADB=1` 启用 Android 工具

注意：`host_exec` 默认关闭，`host_*` 也只允许访问工作区根目录内的路径。

完整配置见 [docs/MCP.md](docs/MCP.md)。

## 文档地图

- [快速开始](docs/getting-started.md)
- [完整使用手册](docs/user-manual.md)
- [MCP Server](docs/MCP.md)
- [桌面自动化](docs/guides/desktop-automation.md)
- [模板匹配](docs/MATCHING.md)
- [无障碍自动化](docs/guides/accessibility.md)
- [Android ADB](docs/guides/android-adb.md)
- [OCR](docs/guides/ocr.md)
- [示例](docs/examples.md)
- [排障](docs/troubleshooting.md)

## 本地开发

```bash
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

**spotterjs License 1.0**，见 [LICENSE](LICENSE) 和 [LICENSE.zh-CN](LICENSE.zh-CN)。

- 免费：个人学习、教学、非商业研究和本地评估
- 商用：产品、SaaS、付费交付、企业生产环境等使用场景需要先联系授权
