# @spotterjs/mcp

## 1.1.0

### Minor Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

### Patch Changes

- 30fc168: Report Android companion device identity (manufacturer, model, and user-set nickname)
  in companion state, and add the android_list_devices MCP tool so agents can tell
  connected phones apart and operate each independently.

  Expose companion screen capture as validated PNG bytes in @spotterjs/plugin-android
  and wire MCP Android capture/template tools to write workspace artifacts and tap
  only after successful visual matches.

- 04cb4eb: Add desktop visual combo tools for MCP agent workflows.

  `desktop_capture_and_ocr`, `desktop_capture_and_find_template`, and
  `desktop_find_template_and_tap` capture once, write an artifact, inspect the
  original in-memory capture, and optionally tap a successful visual match with
  fewer round trips.

- Updated dependencies [30fc168]
- Updated dependencies [7254a3d]
- Updated dependencies
  - @spotterjs/plugin-android@1.1.0
  - @spotterjs/core@1.1.0
  - @spotterjs/base@1.1.0
  - @spotterjs/plugin-ocr@1.1.0

## 1.0.3

### Minor Changes

- Add per-call keyboard delay options, numeric key taps, clipboard-backed text
  writing, and the `desktop_keyboard_tap` MCP tool.
- Add opt-in `debugImage` artifacts for Desktop OCR, template matching, mouse
  clicks, mouse taps, and accessibility taps. OCR text matches now expose
  normalized `matchScore` diagnostics alongside the OCR recognition `score`.

### Patch Changes

- Updated dependencies [5537232]
- Updated dependencies
  - @spotterjs/core@1.0.3
  - @spotterjs/plugin-android@1.0.3
  - @spotterjs/plugin-ocr@1.0.3

## 1.0.1

### Patch Changes

- Reshape the public automation API around stable namespaces.

  - Replace `windowApi`, `findInWindow`, `findAllInWindow`, and `tapInWindow` with the `windows` namespace.
  - Replace `searchRegion` with `region`, and `multiScale` / `scaleMin` / `scaleMax` / `scaleStep` with `scale`.
  - Replace `screen.tapTemplate()` with async `screen.tap()`.
  - Replace root image helpers with `image.decode()`, `image.find()`, and `image.findAll()`.
  - Move `loadNative` and native binding types to `@spotterjs/core/native`.
  - Rebuild native packages in release mode, with the Windows binary statically linking the MSVC CRT.

- Rename `android_wait_for_element`'s element wait timeout from `timeoutMs` to `waitTimeoutMs`; `timeoutMs` now only represents the optional Android connection timeout.

### Patch Changes

- Updated dependencies
  - @spotterjs/core@1.0.1
  - @spotterjs/plugin-android@1.0.1
  - @spotterjs/plugin-ocr@1.0.1

## 1.0.0

### Minor Changes

- acfe3fa: Add optional Android tools and support encoded template images for desktop matching.

### Patch Changes

- Updated dependencies [7119e4b]
- Updated dependencies [acfe3fa]
- Updated dependencies [4efb357]
  - @spotterjs/core@1.0.0
  - @spotterjs/plugin-android@0.2.0
