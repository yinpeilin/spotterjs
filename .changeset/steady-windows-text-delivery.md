---
"@spotterjs/core": patch
"@spotterjs/node": patch
"@spotterjs/cli": patch
---

Keep native Windows text input clipboard-free and ordered through SendInput. Use physical
ASCII key events only when the standard US keyboard layout produces the exact requested text,
otherwise retaining Unicode input. Pace Windows text by at least 1 ms per character even
when zero delay is requested, while keeping the 10 ms default and hotkey timing unchanged.
Explicit Windows paste now retains its clipboard payload
instead of restoring previous text before a slow target may have consumed it. Document the
platform-specific restoration behavior and avoid automatically replaying uncertain input.
