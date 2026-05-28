# spotterjs Documentation

[中文文档](../zh-CN/README.md)

spotterjs is a TypeScript-first desktop automation toolkit backed by Rust native
addons. Use this documentation when you are writing scripts, building MCP tools,
or maintaining the repository.

## Start Here

- [Getting started](./getting-started.md): install packages, run the first script, and verify the local environment.
- [Examples](./examples.md): Paint examples, smoke scripts, WeChat integration scripts, and benchmark commands.
- [Troubleshooting](./troubleshooting.md): common native, matching, Android companion, OCR, MCP, and documentation issues.

## Guides

- [Desktop automation](./guides/desktop-automation.md): windows, capture, input, clipboard, coordinate spaces, and click points.
- [Accessibility automation](./guides/accessibility.md): UIA / AT-SPI trees, element queries, actions, and diagnostics.
- [Template matching](./MATCHING.md): NCC matcher architecture, options, encoded buffers, search regions, and limits.

## Integrations

- [MCP server](./MCP.md): MCP client configuration, desktop / Android / OCR / host tools, response shapes, and security policy.
- [Android companion automation](./guides/android-companion.md): WebSocket pairing, session reuse, device input, and accessibility tree access.
- [OCR plugin](./guides/ocr.md): model download, cache directories, local models, coordinates, and integration tests.

## API Entrypoints

- [`@spotterjs/core`](../../packages/core/README.md): desktop automation API.
- [`@spotterjs/mcp`](../../packages/mcp/README.md): MCP server package.
- [`@spotterjs/plugin-android`](../../packages/plugin-android/README.md): Android companion plugin.
- [`@spotterjs/plugin-ocr`](../../packages/plugin-ocr/README.md): OCR plugin.

## Maintainers

- [Architecture](./development/architecture.md): monorepo layout, TypeScript packages, Rust crates, native packages, and boundaries.
- [Testing](./development/testing.md): unit tests, Rust tests, smoke tests, integration scripts, benchmarks, and packaging checks.
- [Documentation style](./development/documentation-style.md): bilingual docs policy, API comments, examples, and links.
- [Publishing](./PUBLISHING.md): changesets, license sync, native optional packages, and npm publishing order.
- [Cleanup and architecture notes](./CLEANUP-AND-ARCHITECTURE.md): current repository cleanup scope and architecture notes.

## Maintenance Commands

```bash
npm run docs:check
npm run build:ts
```

`docs:check` verifies local Markdown links in both language trees. External
links, mail links, and anchor-only links are ignored.
