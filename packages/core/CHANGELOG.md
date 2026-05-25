# @spotterjs/core

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
  - @spotterjs/base@1.0.1
  - @spotterjs/node@1.0.1

## 1.0.0

### Major Changes

- 4efb357: Remove `@spotterjs/plugin-match-opencv` and `@spotterjs/node-match-opencv`. NCC matcher now supports multi-scale search, parallel scanning, and Buffer/path needles via new native APIs (`findTemplateWithNeedle`, `findTemplateBuffers`). Remove `useMatchPlugin`, `getMatchProvider`, and `createNccMatchProvider`; use `screen.find` directly. Add Buffer needle support for in-window matching.

### Minor Changes

- 7119e4b: Consolidate template-match N-API: `findTemplate(path, needleBuffer?, opts?)` replaces separate `*WithNeedle` exports. Remove `tapTemplate` / `tapTemplateWithNeedle` and `regionCenterJs`. Rename `setMouseConfigJs` / `setKeyboardConfigJs` to `setMouseConfig` / `setKeyboardConfig`. Auto-generate `index.d.ts` from napi-rs; `@spotterjs/core` types bridge via `SpotterNative`.

### Patch Changes

- Updated dependencies [7119e4b]
- Updated dependencies [acfe3fa]
- Updated dependencies [4efb357]
  - @spotterjs/node@1.0.0
  - @spotterjs/base@1.0.0
