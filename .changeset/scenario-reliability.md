---
"@spotterjs/core": patch
"@spotterjs/cli": patch
"@spotterjs/plugin-ocr": patch
"@spotterjs/plugin-android": patch
---

Make window template waits fail promptly on permanent errors and reject invalid
timing. Include screen origins in CLI region-capture results. Allow explicit OCR
initialization retries after a failed cache entry. Release failed Android
handshakes and stop queued commands after transport timeout or protocol mismatch
so late responses cannot acknowledge another action. Add runnable observation
and coordinate-contract examples with explicit environment requirements.
