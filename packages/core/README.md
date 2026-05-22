# @spotterjs/core

spotterjs 桌面自动化的 TypeScript API：截图、模板匹配、键鼠、窗口、无障碍与工作区宿主 I/O。

## 安装

```bash
npm install @spotterjs/core
```

需要对应平台的 `@spotterjs/node` 预编译二进制（Windows x64、Linux x64-gnu）。

## 快速开始

```typescript
import {
  screen,
  mouse,
  desktop,
  windowApi,
  centerOf,
} from "@spotterjs/core";

// 1. 等待目标窗口
const win = desktop.waitForWindow("Notepad", 10_000);

// 2. 窗口内模板匹配并点击
import { tapInWindow } from "@spotterjs/core";
tapInWindow(win.id, "./assets/save-btn.png", { confidence: 0.9 });

// 3. 或全屏匹配
const region = await screen.find("./assets/icon.png", { confidence: 0.85 });
const { x, y } = centerOf(region);
mouse.tap(x, y);
```

## 模块概览

| 导出 | 用途 |
|------|------|
| `screen` | 屏幕尺寸、截图、全屏 NCC 匹配（`find` / `findAll` / `waitFor` / `tapTemplate`） |
| `findInWindow` / `findAllInWindow` / `tapInWindow` | 限定在某个窗口内匹配（更快） |
| `mouse` / `keyboard` / `clipboard` | 输入模拟 |
| `windowApi` | 枚举、聚焦、移动、调整大小、窗口截图 |
| `desktop` | 按进程列出应用、按标题找窗口、`waitForWindow` |
| `accessibility` | UIA / AT-SPI：`quick.attach`、`quick.find`、`quick.click` 等 |
| `host` | 沙箱文件读写与 shell（Agent 场景） |
| `encodePng` / `captureToBase64` | 截图 PNG 编码 |
| `toMatchBox` / `matchTapScreen` | 屏幕坐标与窗口局部坐标转换 |
| `loadNative()` | 底层 N-API 逃生舱（见下） |

各 API 在源码与 `.d.ts` 中带有 JSDoc，IDE 悬停可查看参数含义与行为说明。

## 模板匹配

- 算法：归一化互相关（NCC），详见 [docs/MATCHING.md](../../docs/MATCHING.md)
- `needle`：PNG/JPEG/WebP **文件路径**，或已编码图像的 `Buffer`
- 返回的 `Region` 均为**屏幕坐标**
- `searchRegion`：只在屏幕子区域内搜索，结果仍 translated 回屏幕坐标
- 未找到时 **抛出错误**（非 `null`）；`waitFor` 超时同样抛错

```typescript
await screen.find("./btn.png", {
  confidence: 0.9,
  multiScale: true,
  scaleMin: 0.8,
  scaleMax: 1.2,
  searchRegion: { left: 0, top: 0, width: 1920, height: 1080 },
});
```

## 键盘输入

```typescript
import { keyboard } from "@spotterjs/core";

keyboard.write("hello");
keyboard.hotkey(["Ctrl", "V"]);

// `up` 只释放由 `down` 记录的按键；强制 key-up 请用 rawUp。
keyboard.down(["Ctrl"]);
keyboard.up(["Ctrl"]);
```

推荐键名写法是 `"Enter"`、`"Ctrl"`、`"V"`。常见小写别名（如 `"enter"`、`"ctrl"`、`"esc"`）也可解析。

## 无障碍典型流程

```typescript
import { accessibility } from "@spotterjs/core";

accessibility.quick.enable({ eventSubscription: true });
const rootId = accessibility.quick.attach(windowId);
const btnId = accessibility.quick.waitFor(rootId, { name: "发送" }, 5000);
accessibility.quick.click(btnId);
```

日常脚本先用 `accessibility.quick`。如果树里找不到目标元素，再用 `accessibility.debug.dumpTree(rootId)` 查看树结构和诊断数据。

## 何时使用 `loadNative()`

日常自动化请用上述高层模块。仅在以下情况调用 `loadNative()`：

- 内存 haystack/needle 匹配（`findTemplateBuffers`）
- 尚未封装的 native 能力
- 与 Rust 层脚本直接集成

类型为 `SpotterNative`（来自 `@spotterjs/node` 自动生成绑定）。

## MCP

MCP 服务端：[`@spotterjs/mcp`](../mcp) — 见 [docs/MCP.md](../../docs/MCP.md)。

## License

Learning and non-commercial use are free. Commercial use: `ypl123698745@qq.com` or [Gitee Issues](https://gitee.com/ypl0lpy/spotterjs/issues). See [LICENSE](../../LICENSE).
