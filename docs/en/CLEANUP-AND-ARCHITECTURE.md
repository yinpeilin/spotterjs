# Cleanup and Architecture Notes

[中文文档](../zh-CN/CLEANUP-AND-ARCHITECTURE.md)

This page records historical cleanup context. For the current architecture
guide, start with [Architecture](./development/architecture.md).

## Current Direction

- `@spotterjs/core` is the high-level TypeScript entrypoint.
- `@spotterjs/node` is the native loader.
- NCC template matching is implemented by the Rust matcher path.
- OpenCV-specific matching package paths are no longer part of the public API.

## Stable Public Surface

Prefer these public modules:

- `screen`
- `windows`
- `desktop`
- `mouse`
- `keyboard`
- `clipboard`
- `accessibility`
- `host`
- `image`
- `image.encode` / `image.encodeBase64`

Treat `@spotterjs/core/native` as an escape hatch for low-level scripts and
diagnostics, not as the first choice for user code.
