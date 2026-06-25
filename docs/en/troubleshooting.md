# Troubleshooting

[中文文档](../zh-CN/troubleshooting.md)

Use this guide to diagnose common spotterjs setup and automation issues.

## Native Package Fails to Load

Common symptoms:

- `Cannot find module @spotterjs/node-*`
- `Failed to load native binding`
- Missing MSVC runtime or linker tooling on Windows

Checklist:

1. Confirm the platform is Windows x64 (MSVC) or Linux x64 (glibc).
2. Reinstall dependencies with `npm ci`.
3. From source, run `npm run build:native`.
4. Before publishing, confirm optional native packages were built and published in order.

## Template Matching Cannot Find the Target

Check:

- The template image comes from the same theme, scaling, and app version.
- `confidence` is not too high.
- `region` covers the target.
- The target is visible and not covered.

Useful commands:

```bash
npm run smoke:capture
npm run smoke:match
npm run smoke:match-tap
```

Use `scale` when icon size changes. Narrow `region` when false positives are
common. See [Template matching](./MATCHING.md).

## Mouse Click Position Is Offset

Common causes:

- Treating window-local coordinates as screen coordinates.
- Multi-monitor or DPI scaling confusion.
- Mixing window frame and client-area coordinates.

High-level `screen.findTemplate` and `windows.findTemplate` return coordinates that can
be clicked directly. Use `toMatchBox` and `matchTapScreen` only when you need
manual conversion.

## Accessibility Tree Is Empty or Missing Elements

1. Focus the target window and check for permission boundaries.
2. Dump with `accessibility.debug.dumpTree(rootId, { treeView: "raw" })`.
3. Compare `control`, `content`, and `raw` tree views.
4. For custom-drawn UIs, use template matching or a hybrid strategy.

See [Accessibility automation](./guides/accessibility.md).

## Android Companion Is Unavailable

| State | Action |
|-------|--------|
| WebSocket connection refused | Confirm the phone app is listening and the URL/port match the app screen |
| Pairing fails | Rotate the pairing code in the app and retry with `android.pair` |
| Session rejected | Pair again and reuse the new `sessionToken` |
| Tree or input commands fail | Enable the Spotter accessibility service and, for robust text, select Spotter Keyboard |

See [Android companion automation](./guides/android-companion.md).

## OCR Model Download Fails

1. Try the mirror source: `SPOTTERJS_OCR_MODEL_SOURCE=mirror`.
2. Set a writable cache directory with `SPOTTERJS_OCR_MODEL_DIR`.
3. Prepare `det.onnx`, `rec.onnx`, and `dict.txt` for offline environments.
4. Set `SPOTTERJS_OCR_MODEL_BASE_URL` for private distribution.

See [OCR plugin](./guides/ocr.md).

## MCP Host Tools Cannot Read or Write Files

Check:

- `SPOTTERJS_WORKSPACE_ROOT` points to the intended workspace.
- The target path resolves inside the workspace root.
- The write target is not a denied file such as `.env` or `credentials.json`.
- `host_exec` has `SPOTTERJS_ALLOW_SHELL=1` when shell execution is needed.

See [MCP server](./MCP.md).

## Structured Error Codes

First-party libraries throw `SpotterError` with
`SPOTTER_<DOMAIN>_<REASON>` codes. Use `isSpotterError(error)` and inspect
`error.domain` plus `error.context` for diagnostics.

Common setup codes include `SPOTTER_NATIVE_PACKAGE_MISSING`,
`SPOTTER_NATIVE_LOAD_FAILED`, `SPOTTER_OCR_MODEL_DOWNLOAD_FAILED`, and
`SPOTTER_ANDROID_COMPANION_TIMEOUT`. MCP tool failures include the same
`code`, compressed `context`, and `domain` in the text result.

## Markdown Check Fails

```bash
npm run docs:check
```

The checker validates Markdown UTF-8 encoding and local Markdown links. Fix
encoding damage, relative paths, directory targets, and filename casing.
External links, mail links, and anchor-only links are ignored.
