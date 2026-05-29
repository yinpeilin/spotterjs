# @spotterjs/plugin-android

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

### Patch Changes

- Updated dependencies [5537232]
  - @spotterjs/base@1.0.3
