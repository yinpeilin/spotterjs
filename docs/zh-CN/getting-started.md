# 快速开始

这篇文档面向第一次使用 spotterjs 的用户。完成后，你应该能安装 `@spotterjs/core`，运行一个桌面自动化脚本，并知道下一步该读哪篇指南。

## 环境要求

- Node.js：建议使用当前 LTS 版本。
- 操作系统：Windows x64 (MSVC) 或 Linux x64 (glibc)。
- Windows native 构建：需要 MSVC 工具链和 `link.exe`。
- Linux native 构建：需要对应的系统依赖和 X11 环境。

只作为用户安装时，通常不需要本地 Rust 工具链；从源码开发 native 包时才需要 Rust。

## 安装

用户项目中安装核心包：

```bash
npm install @spotterjs/core
```

源码开发时：

```bash
git clone https://gitee.com/ypl0lpy/spotterjs.git
cd spotterjs
npm ci
npm run build:ts
```

需要编译 native 包时：

```bash
cargo build -p spotterjs-base -p spotterjs-core -p spotterjs-plugin-match-ncc
npm run build:native
```

## 第一个脚本

创建 `hello-spotter.ts`：

```typescript
import { keyboard, mouse, screen } from "@spotterjs/core";

const size = screen.size();
console.log("screen:", size);

keyboard.hotkey(["Ctrl", "L"]);
keyboard.write("hello from spotterjs");

const center = { x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) };
mouse.move(center.x, center.y);
```

运行：

```bash
npx tsx hello-spotter.ts
```

如果脚本会操作真实桌面，请先确认当前焦点窗口是你愿意被输入和点击的窗口。

## 模板匹配点击

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.find("./button.png", {
  confidence: 0.9,
  scale: true,
});

mouse.tap(match.center.x, match.center.y);
```

`needle` 可以是图片路径，也可以是 PNG / JPEG / WebP 编码后的 `Buffer`。更多参数见 [模板匹配](./MATCHING.md)。

## 本地验证

仓库内常用命令：

```bash
npm test
npm run build:ts
npm run smoke
```

`npm run smoke` 会控制本机桌面，适合在开发机上手动确认。只想看示例脚本时，从 [示例地图](./examples.md) 开始。

## 下一步

- 想写桌面脚本：读 [桌面自动化](./guides/desktop-automation.md)。
- 想通过 UI 树找控件：读 [无障碍自动化](./guides/accessibility.md)。
- 想接 MCP 客户端：读 [MCP Server](./MCP.md)。
- 遇到 native、匹配或平台问题：读 [排障指南](./troubleshooting.md)。
