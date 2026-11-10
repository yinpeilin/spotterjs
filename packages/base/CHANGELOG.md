# @spotterjs/base

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
