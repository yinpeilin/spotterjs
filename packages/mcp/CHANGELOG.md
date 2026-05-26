# @spotterjs/mcp

## 2.0.0

### Major Changes

- 834a036: Rename `android_wait_for_element`'s element wait timeout from `timeoutMs` to `waitTimeoutMs`; `timeoutMs` now only represents the optional ADB connection timeout.

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
  - @spotterjs/plugin-android-adb@1.0.1
  - @spotterjs/plugin-ocr@1.0.1

## 1.0.0

### Minor Changes

- acfe3fa: Add optional Android ADB tools and support encoded template images for desktop matching.

### Patch Changes

- Updated dependencies [7119e4b]
- Updated dependencies [acfe3fa]
- Updated dependencies [4efb357]
  - @spotterjs/core@1.0.0
  - @spotterjs/plugin-android-adb@0.2.0
