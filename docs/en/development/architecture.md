# Architecture

[中文文档](../../zh-CN/development/architecture.md)

spotterjs is a TypeScript + Rust monorepo. TypeScript packages provide public
APIs, CLI command adapters, and plugin entrypoints. Rust crates provide platform
automation, image processing, native bindings, and NCC matching.

## Workspace Layout

| Path | Responsibility |
|------|----------------|
| `packages/core` | Main user-facing desktop automation API |
| `packages/base` | Shared TypeScript types |
| `packages/cli` | JSON CLI, command registry, adapters, and bundled agent Skill |
| `packages/plugin-ocr` | OCR plugin, model download, and recognition pipeline |
| `packages/plugin-android` | Android companion automation plugin |
| `crates/spotterjs-base` | Rust shared types, errors, and N-API conversions |
| `crates/spotterjs-core` | Rust platform capabilities: capture, input, windows, accessibility, image |
| `crates/spotterjs-node` | Node native loader and N-API binding |
| `crates/spotterjs-plugin-match-ncc` | NCC template matching implementation |
| `scripts` | Smoke, integration, benchmark, publishing, and maintenance scripts |
| `examples` | Runnable examples |

## Core Call Chain

```text
@spotterjs/core
  -> @spotterjs/node
    -> spotterjs-core
      -> spotterjs-base
      -> spotterjs-plugin-match-ncc
```

Template matching is centralized through `@spotterjs/node` and the Rust NCC
implementation. The repository no longer maintains a separate OpenCV matching
plugin path.

## TypeScript Package Boundaries

- `@spotterjs/core` is the primary desktop automation package.
- `@spotterjs/base` contains shared types and should not load native code.
- `@spotterjs/cli` adapts core capabilities into CLI command schemas without
  changing the core API.
- Plugin packages expose domain APIs only; parsing helpers, path discovery, and
  command escaping helpers are not stable public APIs unless exported.

## Rust Crate Boundaries

- `spotterjs-base` owns cross-crate shared data types and conversions.
- `spotterjs-core` owns platform implementations and reusable native abilities.
- `spotterjs-node` owns N-API exports and platform binary packaging.
- `spotterjs-plugin-match-ncc` focuses on matching algorithms and does not know
  the TypeScript API shape.

## Native Optional Packages

`@spotterjs/node` is the JavaScript loader. Platform binaries are distributed as
optional packages:

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

Publishing order: platform packages first, then `@spotterjs/node`, then
TypeScript packages that depend on it. See [Publishing](../PUBLISHING.md).

## CLI Boundary

The CLI exposes:

- desktop: capture, input, windows, template matching, and optional accessibility.
- android: companion app tools when `SPOTTERJS_ANDROID=1`.
- ocr: OCR tools backed by `@spotterjs/plugin-ocr`.
- host: workspace file tools and optional shell execution.

The CLI validates command arguments and emits structured JSON results. Related
actions use one in-process sequence queue; separate invocations do not share
session state or locks. Android connections close when that process exits.

Host file paths must stay inside the workspace root, shell execution is disabled
by default, and sensitive host writes are denied by default. These host checks
are not an operating-system sandbox for desktop or Android actions. The bundled
Skill teaches command discovery and an observe–act–verify workflow.

## Design Principles

- Prefer high-level APIs for user scripts.
- Treat `@spotterjs/core/unstable-native` as the unstable escape hatch.
- Keep package READMEs short; put deep guides in `docs/en` and `docs/zh-CN`.
- When adding a platform capability, update TypeScript APIs, CLI behavior,
  tests, and both language docs together.
