---
"@spotterjs/plugin-android": patch
"@spotterjs/mcp": patch
---

Report Android companion device identity (manufacturer, model, and user-set nickname)
in companion state, and add the android_list_devices MCP tool so agents can tell
connected phones apart and operate each independently.

Expose companion screen capture as validated PNG bytes in @spotterjs/plugin-android
and wire MCP Android capture/template tools to write workspace artifacts and tap
only after successful visual matches.
