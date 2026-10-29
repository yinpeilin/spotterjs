---
"@spotterjs/core": minor
"@spotterjs/node": patch
---

Use native Unicode text input by default, add keyboard.type, and fix Windows newline,
tab, UTF-16 surrogate release and held-key behavior. Keep explicit paste mode with
configurable clipboard restore delay and preserve clipboard contents copied during input.
Track aliases of the same physical modifier consistently so pressing Ctrl and releasing
LeftControl (and equivalent Shift, Alt, or Meta aliases) cannot leave a key held.
