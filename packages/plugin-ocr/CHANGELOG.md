# @spotterjs/plugin-ocr

## 1.1.2

### Patch Changes

- Improve structured error diagnostics and human-friendly hints across all packages:

  - Add optional `hint`, `formatSpotterError()`, and `diagnoseNativeAddonError()` in `@spotterjs/base` to pinpoint Windows Win32 error 126 missing VC++ runtime or sibling DLL issues, `.asar` packaging issues, architecture mismatches, and Linux shared library / glibc failures.
  - Wrap `onnxruntime-node`, ONNX session/inference, and `sharp` loading in `@spotterjs/plugin-ocr` with actionable `SpotterError` codes (`SPOTTER_OCR_RUNTIME_LOAD_FAILED`, `SPOTTER_OCR_ONNX_SESSION_FAILED`, `SPOTTER_OCR_SHARP_LOAD_FAILED`), surface underlying `fetch failed` causes, add recognized-line samples to `SPOTTER_OCR_TEXT_NOT_FOUND`, and evict failed OCR engine promises from cache.
  - Attach actionable hints for all `SPOTTER_NATIVE_*` errors, native addon load failures, and host sandbox errors in `@spotterjs/core`, and companion connection/protocol/remote errors in `@spotterjs/plugin-android`.
  - Format Zod validation errors cleanly with `SPOTTER_CLI_INVALID_ARGUMENTS` and schema hints, preserve `hint`/`code`/`context` in top-level CLI errors, and evict failed CLI OCR client promises from cache.

- Updated dependencies
- Updated dependencies [dec8599]
  - @spotterjs/base@1.1.2
  - @spotterjs/core@1.1.2

## 1.1.1

### Patch Changes

- 7cf0c2f: Adopt the Apache-2.0 license to allow commercial use, modification, redistribution,
  and integration into proprietary products without separate commercial authorization.
  Update package license metadata and bundled license texts; third-party dependencies
  and OCR models remain subject to their own terms.
- Updated dependencies
- Updated dependencies [7cf0c2f]
  - @spotterjs/base@1.1.1
  - @spotterjs/core@1.1.1

## 1.1.0

### Patch Changes

- 7287ef5: Preserve image and text-crop aspect ratios during fixed-shape ONNX preprocessing.
  Pad detector images and normalized recognition tensors instead of stretching glyphs,
  restore shrunken DB text boxes before cropping, and translate detector output map sizes
  back to source coordinates while excluding detections entirely in padding. Reject
  malformed or multichannel probability-map outputs before postprocessing.
  Map preprocessed text geometry back to source pixels before applying crop/origin
  offsets, including search regions clipped at the source image edges.
- Updated dependencies [7287ef5]
- Updated dependencies [7287ef5]
  - @spotterjs/core@1.1.0

## 1.0.4

### Patch Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

### Patch Changes

- Updated dependencies [7254a3d]
- Updated dependencies
  - @spotterjs/core@1.0.4
  - @spotterjs/base@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [5537232]
- Updated dependencies
  - @spotterjs/base@1.0.3
  - @spotterjs/core@1.0.3

## 1.0.1

### Patch Changes

- Updated dependencies
  - @spotterjs/base@1.0.1

## 1.0.0

### Minor Changes

- acfe3fa: Expose scored template match results, ship the ONNX OCR implementation, and add the Android ADB plugin package.

### Patch Changes

- Updated dependencies [acfe3fa]
  - @spotterjs/base@1.0.0
