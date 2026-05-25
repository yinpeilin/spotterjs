# @spotterjs/plugin-android-adb

## 1.0.1

### Patch Changes

- Reshape the public automation API around stable namespaces.

  - Replace `windowApi`, `findInWindow`, `findAllInWindow`, and `tapInWindow` with the `windows` namespace.
  - Replace `searchRegion` with `region`, and `multiScale` / `scaleMin` / `scaleMax` / `scaleStep` with `scale`.
  - Replace `screen.tapTemplate()` with async `screen.tap()`.
  - Replace root image helpers with `image.decode()`, `image.find()`, and `image.findAll()`.
  - Move `loadNative` and native binding types to `@spotterjs/core/native`.
  - Rebuild native packages in release mode, with the Windows binary statically linking the MSVC CRT.

### Patch Changes

- Updated dependencies
  - @spotterjs/core@1.0.1
  - @spotterjs/base@1.0.1

## 0.2.0

### Minor Changes

- acfe3fa: Expose scored template match results, ship the ONNX OCR implementation, and add the Android ADB plugin package.

### Patch Changes

- Updated dependencies [7119e4b]
- Updated dependencies [acfe3fa]
- Updated dependencies [4efb357]
  - @spotterjs/core@1.0.0
  - @spotterjs/base@1.0.0
