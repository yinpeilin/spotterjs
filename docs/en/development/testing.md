# Testing

[中文文档](../../zh-CN/development/testing.md)

spotterjs uses TypeScript unit tests, Rust tests, smoke scripts, integration
scripts, benchmarks, and packaging checks. These commands cover different risk
areas and should not be treated as interchangeable.

## Key Path Coverage

Default automated tests should avoid real desktop, WeChat, or Android device
dependencies. Put real environment checks in smoke or integration scripts.

When adding key-path coverage, prefer deterministic fixtures for MCP artifacts
and tool schemas, OCR image validation and post-processing, Android
companion protocol routing and accessibility tree pruning, core match wrapper option
mapping, and Rust NCC synthetic matching.

Synthetic benchmarks are report-only baselines. Track
`mcp.optimizeCapture`, `ocr.resizeRgba`, and `ocr.boxesFromBitmap` for trends;
do not turn them into hard CI gates without a separate decision.

## Common Commands

```bash
npm run docs:check
npm run build:ts
npm run test -w @spotterjs/base
npm run test -w @spotterjs/core
npm run test -w @spotterjs/mcp
npm run test -w @spotterjs/plugin-ocr
npm run test -w @spotterjs/plugin-android
cargo test
```

## Change-Based Guidance

- Docs only: run `npm run docs:check`.
- Public TypeScript API comments or declarations: run `npm run build:ts`.
- Core desktop API changes: run `npm run test -w @spotterjs/core`.
- MCP tool schema or behavior changes: run `npm run test -w @spotterjs/mcp`.
- Android companion client behavior: run `npm run test -w @spotterjs/plugin-android`.
- OCR model, image, post-processing, or input-shape behavior: run `npm run test -w @spotterjs/plugin-ocr`.
- Rust native behavior: run the affected `cargo test` package, then relevant smoke scripts.

## Error Assertions

Library errors are public API. When adding error-path coverage, assert the
stable `code` and only the diagnostic `context` fields the caller needs:

```typescript
await expect(ocr.findText(image, "Missing")).rejects.toMatchObject({
  name: "SpotterError",
  code: "SPOTTER_OCR_TEXT_NOT_FOUND",
  context: { text: "Missing" },
  domain: "ocr",
});
```

Prefer `isSpotterError` or stable `SPOTTER_<DOMAIN>_<REASON>` codes when
application code needs programmable catch behavior. Avoid snapshotting whole
error objects because `cause` and platform messages may vary.

## Smoke Scripts

Smoke scripts touch real platform behavior and may control the desktop:

```bash
npm run smoke:version
npm run smoke:capture
npm run smoke:clipboard
npm run smoke:windows
npm run smoke:match
npm run smoke:match-tap
npm run smoke:a11y
npm run smoke:desktop
npm run smoke:android
```

Run them only on a machine where desktop and device automation are safe.

## Integration Scripts

Integration scripts can affect real applications or devices:

```bash
npm run integration:wechat:dump
npm run integration:wechat:match
npm run integration:wechat:send
```

Read script-level comments and environment variables before running them.

## Benchmarks

```bash
npm run benchmark:ci -- --runs 10 --warmup 3 --json test-output/benchmark/results.json --markdown test-output/benchmark/summary.md
npm run benchmark:deep -- --runs 5 --warmup 2
npm run benchmark:ncc
npm run benchmark:ncc:rust
```

`benchmark:ci` runs stable synthetic scenarios and reports results. It should
not fail CI because of performance noise. `benchmark:deep` is for local desktop
and OCR profiling. `benchmark:ncc` and `benchmark:ncc:rust` are NCC-specific.

## Packaging Checks

```bash
npm run sync-license
npm run verify-pack
npm run verify:native-install
```

Run these before publishing or changing package metadata.

## Documentation Checks

```bash
npm run docs:check
```

The checker validates local Markdown links in the repository, including both
language trees. External links, mail links, and anchor-only links are ignored.
