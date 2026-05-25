# 测试指南

spotterjs 的测试分为 TypeScript 单元测试、Rust 测试、Smoke 脚本、integration 脚本和打包验证。不同命令覆盖的风险不同，不要互相替代。

## 常用命令

```bash
npm test
npm run build:ts
npm run docs:check
```

`npm test` 会先运行 Rust 测试，再运行 workspace 中配置的 TypeScript 测试。

## Rust 测试

```bash
npm run test:rust
cargo test
cargo test -p spotterjs-core
cargo test -p spotterjs-plugin-match-ncc
```

平台 integration 测试默认不在普通测试里运行：

```bash
npm run test:rust:ignored
cargo test -p spotterjs-core --features linux-x11
```

## TypeScript 包测试

```bash
npm run test -w @spotterjs/core
npm run test -w @spotterjs/mcp
npm run test -w @spotterjs/plugin-ocr
npm run test -w @spotterjs/plugin-android-adb
```

适用场景：

- 改 core API：跑 `@spotterjs/core`。
- 改 MCP tool schema 或行为：跑 `@spotterjs/mcp`。
- 改 ADB 解析、连接、多设备逻辑：跑 `@spotterjs/plugin-android-adb`。
- 改 OCR 模型解析、后处理、输入形状：跑 `@spotterjs/plugin-ocr`。

## Smoke 脚本

Smoke 脚本会控制真实桌面：

```bash
npm run smoke
npm run smoke:capture
npm run smoke:match
npm run smoke:match-tap
npm run smoke:a11y
npm run smoke:desktop
npm run smoke:android
```

运行前确认当前桌面可以被聚焦、点击和输入。CI 不应默认运行会控制真实桌面的脚本。

## Integration 脚本

微信脚本会操作真实应用：

```bash
npm run integration:wechat:dump
npm run integration:wechat:match
npm run integration:wechat:send
```

`integration:wechat:send` 会发送真实消息，只能在明确确认联系人和消息内容后运行。

## Benchmark

```bash
npm run smoke:capture
npm run benchmark:ncc
npm run benchmark:ncc:rust
```

`benchmark:ncc:rust` 用于观察纯匹配性能；`benchmark:ncc` 包含截图和 TypeScript 调用路径。

## 打包验证

```bash
npm run sync-license
npm run verify-pack
```

发布前需要确认 license 已同步到各包，并检查 package 内容符合预期。更多流程见 [发布手册](../PUBLISHING.md)。

## 文档验证

```bash
npm run docs:check
```

该命令检查 Markdown 本地相对链接。新增、移动或重命名文档时必须运行。
