# @spotterjs/plugin-android

## 1.0.4

### Patch Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

### Patch Changes

- 30fc168: Report Android companion device identity (manufacturer, model, and user-set nickname)
  in companion state, and add the android_list_devices MCP tool so agents can tell
  connected phones apart and operate each independently.

  Expose companion screen capture as validated PNG bytes in @spotterjs/plugin-android
  and wire MCP Android capture/template tools to write workspace artifacts and tap
  only after successful visual matches.

- Updated dependencies
  - @spotterjs/base@1.0.4

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
