---
"@spotter/core": major
"@spotter-rs/node": minor
---

Remove `@spotter/plugin-match-opencv` and `@spotter-rs/node-match-opencv`. NCC matcher now supports multi-scale search, parallel scanning, and Buffer/path needles via new native APIs (`findTemplateWithNeedle`, `findTemplateBuffers`). Remove `useMatchPlugin`, `getMatchProvider`, and `createNccMatchProvider`; use `screen.find` directly. Add Buffer needle support for in-window matching.
