# 无障碍自动化指南

无障碍能力适合处理文本、按钮、菜单等结构化控件。Windows 使用 UI Automation，Linux 使用 AT-SPI2。

## 何时使用

- 需要按控件名称、类型、状态查找元素。
- 模板图像容易受主题、缩放、语言影响。
- 需要 dump UI 树来诊断应用结构。

模板匹配适合找视觉稳定的图标或区域；无障碍适合找语义稳定的控件。复杂脚本可以混用两者。

## 快速流程

```typescript
import { accessibility, desktop } from "@spotterjs/core";

accessibility.quick.enable({ eventSubscription: true });

const win = desktop.waitForWindow("Notepad", 10_000);
const rootId = accessibility.quick.attach(win.id);
const editId = accessibility.quick.find(rootId, {
  controlType: "Edit",
});

accessibility.quick.click(editId);
```

## 查询元素

```typescript
const buttonId = accessibility.quick.waitFor(
  rootId,
  { controlType: "Button", name: "OK" },
  5000
);

accessibility.quick.invoke(buttonId);
```

常用查询字段：

| 字段 | 用途 |
|------|------|
| `name` | 控件显示名称 |
| `controlType` | Button、Edit、ListItem 等控件类型 |
| `automationId` | 应用提供的稳定自动化 ID |
| `className` | 控件类名，适合诊断或兜底 |

## Dump UI 树

当查不到元素时，先 dump 树：

```typescript
const tree = accessibility.debug.dumpTree(rootId, {
  treeView: "control",
});

console.log(tree);
```

`treeView` 可选值：

| 模式 | 用途 |
|------|------|
| `control` | 日常自动化推荐，过滤到控件视图 |
| `content` | 更关注内容节点 |
| `raw` | 保留完整原始树，适合底层诊断 |
| `auto` | 让底层根据平台选择 |

## 诊断信息

```typescript
const report = accessibility.debug.attachWindowReport(win.id);
const info = accessibility.debug.getElementInfo(buttonId);
const health = accessibility.debug.treeHealth(rootId);
```

优先看：

- attach 是否命中正确窗口。
- 树是否为空或节点数量异常。
- 元素是否支持 invoke、selection、value 等 pattern。
- 坐标是否落在目标窗口内。

## 平台注意事项

- Windows UIA 对传统 Win32、WPF、UWP 支持较好，但自绘界面可能只有有限节点。
- Linux 需要应用和桌面环境启用 AT-SPI2。
- Electron、浏览器和部分跨平台 UI 框架可能暴露大量嵌套节点，查询条件要尽量具体。

## 示例

Paint UI 树示例：

```bash
npm run example:paint:ui-tree
npm run example:paint:ui-query
```

更多脚本见 [示例地图](../examples.md)。
