# 桌面自动化指南

`@spotterjs/core` 是日常桌面自动化入口，覆盖屏幕、窗口、鼠标、键盘、剪贴板、模板匹配和坐标转换。

## 常用导入

```typescript
import {
  clipboard,
  desktop,
  keyboard,
  mouse,
  screen,
  windows,
} from "@spotterjs/core";
```

## 窗口流程

```typescript
const win = desktop.waitForWindow("Notepad", 10_000);
windows.focus(win.id);

const active = windows.active();
console.log(active.title, active.region);
```

当目标窗口稳定可识别时，优先把自动化范围限制在窗口内。这样能减少全屏搜索误匹配，也能降低截图和匹配开销。

```typescript
const match = windows.findTemplate(win.id, "./assets/save.png", { confidence: 0.9 });
windows.tapTemplate(win.id, "./assets/save.png", { confidence: 0.9 });
console.log(match.center);
```

## 截图与编码

```typescript
const cap = screen.capture();
const regionCap = screen.capture({ left: 0, top: 0, width: 800, height: 600 });
```

需要传给 MCP、网页或日志系统时，使用 PNG 编码工具：

```typescript
import { encodePng, encodePngBase64 } from "@spotterjs/core";

const bytes = encodePng(cap);
const base64 = encodePngBase64(cap);
```

## 鼠标、键盘、剪贴板

```typescript
mouse.move(200, 300);
mouse.click("left");
mouse.tap(200, 300);

keyboard.write("hello");
keyboard.hotkey(["Ctrl", "V"]);

clipboard.set("text from spotterjs");
const text = clipboard.get();
```

`keyboard.up()` 只释放由 `keyboard.down()` 记录的按键。需要强制释放底层按键时，使用 raw API 前先确认当前键盘状态，避免影响用户正在使用的桌面。

## 模板匹配

```typescript
const found = await screen.find("./button.png", {
  confidence: 0.9,
  region: { left: 100, top: 80, width: 900, height: 600 },
  scale: { min: 0.8, max: 1.2 },
});

mouse.tap(found.center.x, found.center.y);
```

高层匹配 API 返回屏幕坐标。`region` 只限制搜索范围，不改变返回坐标系。

更多匹配细节见 [模板匹配](../MATCHING.md)。

## 坐标空间

spotterjs 里常见坐标有两类：

| 坐标 | 来源 | 说明 |
|------|------|------|
| 屏幕坐标 | `screen.find`、`screen.capture` | 以整个桌面为原点 |
| 窗口局部坐标 | 部分窗口内部逻辑 | 以窗口客户区或截图区域为原点 |

使用 `toMatchBox` 和 `matchTapScreen` 可以把窗口 frame 和匹配结果整理成可点击点：

```typescript
import { matchTapScreen, toMatchBox } from "@spotterjs/core";

const box = toMatchBox(win.region, found.region);
const point = matchTapScreen(box);
mouse.tap(point.x, point.y);
```

## 实践建议

- 优先使用窗口内匹配，再退回全屏匹配。
- 给模板匹配设置合理 `confidence`，不要用过低阈值掩盖模板质量问题。
- 自动化真实应用前，先在 Paint 或 Notepad 上验证输入、点击和焦点行为。
- 会修改真实数据的脚本放在 `scripts/integration/`，并在 README 中写清风险。
