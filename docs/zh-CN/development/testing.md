# 测试指南

## 关键路径覆盖

Default automated tests should avoid real desktop, WeChat, or Android device dependencies. Put real environment checks in smoke or integration scripts.

When adding key-path coverage, prefer deterministic fixtures for MCP artifacts and tool schemas, OCR image validation and post-processing, Android UIAutomator XML parsing and maxDepth pruning, core match wrapper option mapping, and Rust NCC synthetic matching.

Synthetic benchmarks are report-only baselines. Track `mcp.optimizeCapture`, `ocr.resizeRgba`, `ocr.boxesFromBitmap`, `android.parseUiautomatorXml`, and `android.findAndroidElements` for trend changes; do not turn these into hard CI gates without a separate decision.

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
npm run test -w @spotterjs/plugin-android
```

适用场景：

- 改 core API：跑 `@spotterjs/core`。
- 改 MCP tool schema 或行为：跑 `@spotterjs/mcp`。
- 改 Android companion client 或协议逻辑：跑 `@spotterjs/plugin-android`。
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

## 集成脚本

微信脚本会操作真实应用：

```bash
npm run integration:wechat:dump
npm run integration:wechat:match
npm run integration:wechat:send
```

`integration:wechat:send` 会发送真实消息，只能在明确确认联系人和消息内容后运行。

## Benchmark

```bash
npm run benchmark:ci -- --runs 10 --warmup 3 --json test-output/benchmark/results.json --markdown test-output/benchmark/summary.md
npm run benchmark:deep -- --runs 5 --warmup 2
npm run smoke:capture
npm run benchmark:ncc
npm run benchmark:ncc:rust
```

`benchmark:ci` 跑稳定 synthetic 基准，默认只报告，不因性能波动阻断 CI。`benchmark:deep` 用于本机深测，覆盖真实截图、OCR 模型和端到端路径。

`benchmark:ncc:rust` 用于观察纯匹配性能；`benchmark:ncc` 包含截图和 TypeScript 调用路径。它们是 NCC 专项入口，不替代 `benchmark:ci` / `benchmark:deep` 的整库性能报告。

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
## 错误断言

库错误类型是公共 API。新增错误路径测试时，优先断言稳定 `code` 和必要的
`context` 字段：

```typescript
await expect(ocr.findText(image, "Missing")).rejects.toMatchObject({
  name: "SpotterError",
  code: "SPOTTER_OCR_TEXT_NOT_FOUND",
  context: { text: "Missing" },
  domain: "ocr",
});
```

应用代码需要可编程 catch 时，优先使用 `isSpotterError` 或稳定的
`SPOTTER_<DOMAIN>_<REASON>` code。不要快照整个错误对象，因为 `cause`
和平台错误消息可能随环境变化。
