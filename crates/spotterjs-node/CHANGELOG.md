# @spotterjs/node

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

## 1.1.0

### Patch Changes

- 7287ef5: Constrain Windows accessibility attachment fallbacks to the requested window and its
  descendants, so a covering application cannot become the target. Return structured
  errors for null, invalid, or stale window handles instead of panicking.
- 7287ef5: Use native Unicode text input by default, add keyboard.type, and fix Windows newline,
  tab, UTF-16 surrogate release and held-key behavior. Keep explicit paste mode with
  configurable clipboard restore delay and preserve clipboard contents copied during input.
  Track aliases of the same physical modifier consistently so pressing Ctrl and releasing
  LeftControl (and equivalent Shift, Alt, or Meta aliases) cannot leave a key held.
- 7287ef5: Serialize recorded input and playback scripts with the public camelCase timing fields
  `tMs`, `delayMs`, and `durationMs`. Continue accepting legacy snake_case timing fields
  when parsing saved recordings so existing recordings remain replayable.

## 1.0.4

### Patch Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

## 1.0.3

### Minor Changes

- Add per-call keyboard delay options, numeric key taps, clipboard-backed text
  writing, and the `desktop_keyboard_tap` MCP tool.

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

- 7119e4b: Consolidate template-match N-API: `findTemplate(path, needleBuffer?, opts?)` replaces separate `*WithNeedle` exports. Remove `tapTemplate` / `tapTemplateWithNeedle` and `regionCenterJs`. Rename `setMouseConfigJs` / `setKeyboardConfigJs` to `setMouseConfig` / `setKeyboardConfig`. Auto-generate `index.d.ts` from napi-rs; `@spotterjs/core` types bridge via `SpotterNative`.

### Minor Changes

- 4efb357: Remove `@spotterjs/plugin-match-opencv` and `@spotterjs/node-match-opencv`. NCC matcher now supports multi-scale search, parallel scanning, and Buffer/path needles via new native APIs (`findTemplateWithNeedle`, `findTemplateBuffers`). Remove `useMatchPlugin`, `getMatchProvider`, and `createNccMatchProvider`; use `screen.find` directly. Add Buffer needle support for in-window matching.
