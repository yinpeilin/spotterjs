---
"@spotterjs/base": major
"@spotterjs/core": minor
"@spotterjs/plugin-android-adb": major
---

Clarify public package boundaries: lock `@spotterjs/base` to root exports, add
`@spotterjs/core/unstable-native` as the preferred native escape hatch while
keeping `@spotterjs/core/native` as a deprecated compatibility alias, and move
Android UIAutomator parsing helpers from the package root to
`@spotterjs/plugin-android-adb/uiautomator`.

Breaking changes: deep imports from `@spotterjs/base` are no longer allowed,
and `findAndroidElements` / `parseUiautomatorXml` are no longer exported from
the `@spotterjs/plugin-android-adb` root entrypoint.
