# 快速开始

这篇文档面向第一次使用 spotterjs 的用户。完成后，你应该能安装 `@spotterjs/core`，运行一个桌面自动化脚本，并知道下一步该读哪篇指南。

## 环境要求

- Node.js：建议使用当前 LTS 版本。
- 操作系统：Windows x64 (MSVC) 或 Linux x64 (glibc)。
- Windows native 构建：需要 MSVC 工具链和 `link.exe`。
- Linux native 构建：需要对应的系统依赖和 X11 环境。

安装已发布的 npm 包不需要 Rust。首次从源码构建时需要 Rust，具体见下方说明。

## 安装

用户项目中安装核心包：

```bash
npm install @spotterjs/core
```

## 源码开发

首次从源码构建时，`@spotterjs/node` 链接到本地工作区，所需的 `index.js`、
`index.d.ts` 和原生二进制由构建生成，不在版本控制中。只安装 optional 平台包
不会生成这些文件，因此需要先构建 native，再构建 TypeScript。

请安装 `rust-toolchain.toml` 指定的 Rust 工具链。Windows 还需要 MSVC C++
构建工具和 Windows SDK。Linux x64 需要 C/C++ 工具链和 X11 开发库；
桌面自动化需要 X11 会话。

Windows x64：

```bash
git clone https://github.com/yinpeilin/spotterjs.git
cd spotterjs
npm ci
npm run build:native
npm run build:ts
```

Linux x64 请将 native 构建命令替换为以下命令，以启用 X11：

```bash
npm run build:linux -w @spotterjs/node
```

随后运行 `npm run build:ts`。完成首次 native 构建后，只改 TypeScript 时可以直接运行
`npm run build:ts`；修改 Rust/N-API 时需要重新构建 native。新检出的源码若报
`TS2307`、找不到 `@spotterjs/node` 类型声明，请先执行对应平台的 native 构建。

## 第一个脚本

先跑这个脚本，确认 `@spotterjs/core` 能正常加载，也能读取屏幕和截图数据。

创建 `check-spotter.ts`：

```typescript
import { screen } from "@spotterjs/core";

const size = screen.getSize();
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

上面的连通性脚本不会输入或点击。下面的模板匹配脚本会操作真实桌面，请先确认当前窗口适合被点击。

## 模板匹配点击

如果你已经准备好了按钮或图标截图，再用这个脚本验证模板匹配和点击：

```typescript
import { mouse, screen } from "@spotterjs/core";

const match = await screen.findTemplate("./button.png", {
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
- 想让 Agent 通过命令行操作：读 [CLI + Skill](./CLI.md)。
- 遇到 native、匹配或平台问题：读 [排障指南](./troubleshooting.md)。
