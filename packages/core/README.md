# @spotterjs/core

spotterjs 桌面自动化主入口，提供截图、模板匹配、鼠标、键盘、窗口、无障碍和受控 host I/O API。

## 安装

```bash
npm install @spotterjs/core
```

需要对应平台的 `@spotterjs/node` 预编译二进制。当前支持 Windows x64 (MSVC) 和 Linux x64 (glibc)。

## 快速开始

```typescript
import { keyboard, mouse, screen } from "@spotterjs/core";

const match = await screen.find("./assets/button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
keyboard.write("hello");
```

窗口内匹配：

```typescript
import { desktop, windows } from "@spotterjs/core";

const win = desktop.waitForWindow("Notepad", 10_000);
windows.tapTemplate(win.id, "./assets/save-btn.png", { confidence: 0.9 });
```

## 模块概览

| 导出 | 用途 |
|------|------|
| `screen` | 屏幕尺寸、截图、全屏 NCC 匹配：`find` / `findAll` / `waitFor` / `tap` |
| `windows` | 枚举、聚焦、移动、调整大小、窗口截图和窗口内模板匹配 |
| `mouse` / `keyboard` / `clipboard` | 输入模拟和剪贴板 |
| `desktop` | 按进程列出应用、按标题找窗口、`waitForWindow` |
| `accessibility` | UIA / AT-SPI：`quick.attach`、`quick.find`、`quick.click` 等 |
| `host` | 沙箱文件读写与 shell，主要用于 Agent 场景 |
| `encodePng` / `encodePngBase64` | 截图 PNG 编码；`captureToBase64` 是兼容别名 |
| `toMatchBox` / `matchTapScreen` | 屏幕坐标与窗口局部坐标转换 |
| `image` | 已截图 RGBA 图像上的模板匹配和 encoded image buffer 解码 |
| `@spotterjs/core/native` | 不稳定的底层 N-API 逃生舱 |

各 API 在源码与 `.d.ts` 中带有 JSDoc，IDE 悬停可查看参数含义与行为说明。

## 深入阅读

- [快速开始](../../docs/getting-started.md)
- [桌面自动化指南](../../docs/guides/desktop-automation.md)
- [模板匹配](../../docs/MATCHING.md)
- [无障碍自动化](../../docs/guides/accessibility.md)
- [排障指南](../../docs/troubleshooting.md)

## License

Learning and non-commercial use are free. Commercial use requires authorization. See [LICENSE](../../LICENSE).
