# @spotterjs/base

## 1.1.2

### Patch Changes

- Improve structured error diagnostics and human-friendly hints across all packages:

  - Add optional `hint`, `formatSpotterError()`, and `diagnoseNativeAddonError()` in `@spotterjs/base` to pinpoint Windows Win32 error 126 missing VC++ runtime or sibling DLL issues, `.asar` packaging issues, architecture mismatches, and Linux shared library / glibc failures.
  - Wrap `onnxruntime-node`, ONNX session/inference, and `sharp` loading in `@spotterjs/plugin-ocr` with actionable `SpotterError` codes (`SPOTTER_OCR_RUNTIME_LOAD_FAILED`, `SPOTTER_OCR_ONNX_SESSION_FAILED`, `SPOTTER_OCR_SHARP_LOAD_FAILED`), surface underlying `fetch failed` causes, add recognized-line samples to `SPOTTER_OCR_TEXT_NOT_FOUND`, and evict failed OCR engine promises from cache.
  - Attach actionable hints for all `SPOTTER_NATIVE_*` errors, native addon load failures, and host sandbox errors in `@spotterjs/core`, and companion connection/protocol/remote errors in `@spotterjs/plugin-android`.
  - Format Zod validation errors cleanly with `SPOTTER_CLI_INVALID_ARGUMENTS` and schema hints, preserve `hint`/`code`/`context` in top-level CLI errors, and evict failed CLI OCR client promises from cache.

## 1.1.1

### Patch Changes

- Recover Windows cursor, mouse button, and keyboard input after the calling thread
  loses the input desktop. Report failed recovery with the original Win32 error,
  recovery stage, and a snapshot of the caller's desktop, session, window station,
  and foreground window in both the error message and `context.diagnostics`.
  Clear stale Windows error codes and avoid replaying partially accepted input.
- 7cf0c2f: Adopt the Apache-2.0 license to allow commercial use, modification, redistribution,
  and integration into proprietary products without separate commercial authorization.
  Update package license metadata and bundled license texts; third-party dependencies
  and OCR models remain subject to their own terms.

## 1.0.4

### Patch Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

## 1.0.3

### Major Changes

- 5537232: Clarify public package boundaries: lock `@spotterjs/base` to root exports, add
  `@spotterjs/core/unstable-native` as the preferred native escape hatch while
  keeping `@spotterjs/core/native` as a deprecated compatibility alias, and
  replace the Android ADB plugin surface with the companion-client API exposed by
  `@spotterjs/plugin-android`.

  Breaking changes: deep imports from `@spotterjs/base` are no longer allowed,
  and the old Android ADB helpers are no longer part of the published Android
  plugin surface.

## 1.0.1

### Patch Changes

- Reshape the public automation API around stable namespaces.

  - Replace `windowApi`, `findInWindow`, `findAllInWindow`, and `tapInWindow` with the `windows` namespace.
  - Replace `searchRegion` with `region`, and `multiScale` / `scaleMin` / `scaleMax` / `scaleStep` with `scale`.
  - Replace `screen.tapTemplate()` with async `screen.tap()`.
  - Replace root image helpers with `image.decode()`, `image.find()`, and `image.findAll()`.
  - Move `loadNative` and native binding types to `@spotterjs/core/native`.
  - Rebuild native packages in release mode, with the Windows binary statically linking the MSVC CRT.

## 1.0.0

### Major Changes

- acfe3fa: Expose scored template match results, ship the ONNX OCR implementation, and add the Android ADB plugin package.
