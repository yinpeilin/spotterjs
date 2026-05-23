# @spotterjs/node

## 1.0.0

### Major Changes

- 7119e4b: Consolidate template-match N-API: `findTemplate(path, needleBuffer?, opts?)` replaces separate `*WithNeedle` exports. Remove `tapTemplate` / `tapTemplateWithNeedle` and `regionCenterJs`. Rename `setMouseConfigJs` / `setKeyboardConfigJs` to `setMouseConfig` / `setKeyboardConfig`. Auto-generate `index.d.ts` from napi-rs; `@spotterjs/core` types bridge via `SpotterNative`.

### Minor Changes

- 4efb357: Remove `@spotterjs/plugin-match-opencv` and `@spotterjs/node-match-opencv`. NCC matcher now supports multi-scale search, parallel scanning, and Buffer/path needles via new native APIs (`findTemplateWithNeedle`, `findTemplateBuffers`). Remove `useMatchPlugin`, `getMatchProvider`, and `createNccMatchProvider`; use `screen.find` directly. Add Buffer needle support for in-window matching.
