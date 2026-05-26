# Examples and Scripts

[中文文档](../zh-CN/examples.md)

This page maps the runnable examples and scripts in the repository.

## Paint Examples

Paint examples are safe, visible desktop automation exercises for Windows.

```bash
npm run examples:paint
npm run example:paint:open-focus
npm run example:paint:capture
npm run example:paint:match-tool
npm run example:paint:click-tool
npm run example:paint:input
npm run example:paint:ui-tree
npm run example:paint:ui-query
```

See [examples/README.md](../../examples/README.md) for more details.

## Smoke Scripts

Smoke scripts verify local platform behavior and may control the real desktop.

```bash
npm run smoke
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

## Integration Scripts

Integration scripts may affect real applications or devices. Read each script
before running it.

```bash
npm run integration:wechat:dump
npm run integration:wechat:match
npm run integration:wechat:send
```

## Benchmarks

```bash
npm run benchmark:ci
npm run benchmark:deep
npm run benchmark:ncc
npm run benchmark:ncc:rust
```

`benchmark:ci` uses deterministic synthetic scenarios. `benchmark:deep` uses
local desktop and OCR paths and is intended for manual profiling.

## Where Outputs Go

Most scripts write screenshots, benchmark reports, or diagnostics under
`test-output/`. This directory is local output and should not be treated as
source documentation.
