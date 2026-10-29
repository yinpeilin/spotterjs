---
"@spotterjs/node": patch
---

Constrain Windows accessibility attachment fallbacks to the requested window and its
descendants, so a covering application cannot become the target. Return structured
errors for null, invalid, or stale window handles instead of panicking.
