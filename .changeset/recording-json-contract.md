---
"@spotterjs/node": patch
---

Serialize recorded input and playback scripts with the public camelCase timing fields
`tMs`, `delayMs`, and `durationMs`. Continue accepting legacy snake_case timing fields
when parsing saved recordings so existing recordings remain replayable.
