# spotterjs 使用手册

这份手册面向第一次接触 spotterjs 的使用者，也适合已经会写脚本、但还不熟悉本仓库结构的人。

如果你只是想先跑起来，先看 [快速开始](./getting-started.md)。如果你要接入 MCP，直接看 [MCP Server](./MCP.md)。

## 1. 你会用到什么

spotterjs 的核心思路很简单：用 TypeScript 写自动化脚本，底层由 native 能力完成截图、模板匹配、鼠标键盘输入、窗口操作、无障碍树访问，以及 MCP 暴露。

常见场景：

- 桌面应用回归测试
- 通过图片或无障碍定位控件
- 批量处理窗口、剪贴板和输入
- 通过 MCP 让 AI 客户端操作本地工作区、桌面和 Android 设备

## 2. 安装与环境

最常见的安装方式：

```bash
npm install @spotterjs/core
```

如果你要直接在本仓库里开发：

```bash
npm ci
npm run build:ts
```

运行 native 包源码构建时，当前预构建平台是：

- Windows x64 (MSVC)
- Linux x64 (glibc)

如果你是从源码改 native 层，再看 [快速开始](./getting-started.md) 里的 native 构建步骤。

## 3. 核心概念

### 屏幕和坐标

`screen`、`mouse`、`keyboard` 处理的是屏幕坐标系。模板匹配返回的结果也会落在屏幕坐标上。

### 窗口

`windows` 和 `desktop` 用来处理窗口列表、前台窗口、聚焦和窗口内匹配。

### 模板匹配

`screen.find()` 用图像模板在当前屏幕中找目标，适合按钮、图标、状态指示器这类视觉元素。

### 无障碍

`accessibility` 适合有稳定 UI 树的桌面应用。它比图像匹配更稳，但前提是目标应用暴露了可用的无障碍树。

### 工作区 I/O

MCP 里的 `host_*` 工具只允许访问工作区根目录内的文件。它适合让 AI 安全读取脚本、日志和测试产物，不适合把它当成任意系统文件接口。

## 4. 第一个脚本

```typescript
import { keyboard, mouse, screen } from "@spotterjs/core";

const size = screen.size();
console.log("screen:", size);

keyboard.hotkey(["Ctrl", "L"]);
keyboard.write("hello from spotterjs");

mouse.move(Math.floor(size.width / 2), Math.floor(size.height / 2));
```

运行：

```bash
npx tsx hello-spotter.ts
```

如果脚本会操作真实窗口，先确认当前焦点窗口是你愿意被输入和点击的窗口。

## 5. 桌面自动化

桌面自动化通常分成四步：

1. 让目标窗口处于可操作状态
2. 找到目标区域
3. 执行点击、输入或拖拽
4. 校验结果

示例：

```typescript
import { desktop, mouse, screen } from "@spotterjs/core";

const win = desktop.waitForWindow("Notepad", 10_000);
const match = await screen.find("./assets/button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

适合先读的专题：

- [桌面自动化](./guides/desktop-automation.md)
- [示例](./examples.md)

## 6. 模板匹配

模板匹配适合这些元素：

- 工具栏按钮
- 图标
- 固定布局里的状态块
- 截图中重复出现的视觉控件

基本写法：

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

注意：

- 模板图片尽量来自同主题、同缩放比例、同应用版本
- 目标区太大时可以收缩 `region`
- 尺寸变化较大时启用 `scale`
- 需要更完整的参数说明时看 [模板匹配](./MATCHING.md)

## 7. 无障碍自动化

当视觉不稳定、但 UI 树稳定时，优先考虑无障碍。

常见流程：

1. 先 attach 到目标窗口
2. 再查找元素
3. 最后 invoke / click / dump tree 进行验证

示例思路：

```typescript
import { accessibility, desktop } from "@spotterjs/core";

const win = desktop.waitForWindow("Notepad", 10_000);
const root = accessibility.quick.attach(win.id);
const id = accessibility.quick.find(root, { nameContains: "Save" });
accessibility.quick.click(id);
```

如果你需要排查树结构，先看 [无障碍自动化](./guides/accessibility.md)，再看 [排障](./troubleshooting.md)。

## 8. Android ADB

Android 自动化适合这些任务：

- 真机回归
- 多设备批量操作
- 通过 UIAutomator 树定位元素
- 用截图或模板匹配补充无障碍能力

建议流程：

1. 先确认 `adb devices -l` 正常
2. 再接入 `@spotterjs/plugin-android-adb`
3. 最后跑设备发现、连接、截图和元素查找

如果你更偏向 MCP 场景，直接看 `docs/MCP.md` 里的 `android_*` 工具说明。

专题文档：

- [Android ADB](./guides/android-adb.md)
- [排障](./troubleshooting.md)

## 9. OCR

OCR 适合从截图里读文本，比如：

- 截图中的提示语
- 图片里的状态文案
- 非标准控件中的可见文字

流程一般是：

1. 先截屏
2. 再把图片交给 OCR
3. 最后按文字或坐标回点

专题文档：

- [OCR](./guides/ocr.md)

## 10. MCP

MCP 适合让 AI 客户端直接调用 spotterjs 的桌面、文件、OCR、Android 和无障碍工具。

最小配置：

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

默认只会启用桌面、文件和 OCR。要打开更多能力：

- `SPOTTERJS_ALLOW_SHELL=1` 启用 `host_exec`
- `SPOTTERJS_A11Y=1` 启用无障碍工具
- `SPOTTERJS_ANDROID_ADB=1` 启用 Android 工具

验证顺序建议：

1. 先用 MCP Inspector 或客户端确认 server 能启动
2. 再调用 `host_shell_info`
3. 再试 `desktop_list_apps` 或 `desktop_capture_screen`
4. 如果启用了额外能力，再试 `desktop_a11y_dump_tree` 或 `android_discover_devices`

完整说明见 [MCP Server](./MCP.md)。

## 11. 常见问题

### 目标找不到

- 先确认模板图片和目标来自同一版本
- 再缩小 `region`
- 再检查是否需要 `scale`
- 还是不稳就考虑无障碍

### 鼠标点偏了

- 检查是不是把窗口局部坐标当成屏幕坐标了
- 检查多显示器和 DPI 缩放
- 检查抓图区域和点击区域是否来自同一个坐标系

### MCP 里看不到 shell

- 确认 `SPOTTERJS_ALLOW_SHELL=1`
- 确认工作区根目录在允许范围内
- 确认客户端重新加载了配置

### Android 连不上

- 先看设备授权状态
- 再确认 `adb` 可执行文件是否在 PATH 中
- 再查 Wi-Fi 调试的配对端口和连接端口是否填对

## 12. 下一步

- 想系统学 API：看 [快速开始](./getting-started.md)
- 想看真实脚本：看 [示例](./examples.md)
- 想接 MCP：看 [MCP Server](./MCP.md)
- 想排查问题：看 [排障](./troubleshooting.md)
