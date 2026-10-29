---
"@spotterjs/cli": minor
"@spotterjs/core": minor
---

Replace the protocol server package with a standalone CLI and bundled agent skill.
Provide command discovery, JSON schemas, JSON/file/stdin arguments, validated sequential
workflows, structured results and nonzero failure statuses. Preserve desktop, OCR, host,
Android and recording operations while removing protocol transports and remote workers.
Add self-contained accessibility inspect/action commands and fixed-duration input recording
for independent CLI invocations. Bundle a discoverable, installable Skill with command
recipes, literal Unicode input guidance, and process-local session rules.
Expose accessibility.disable() so command scopes can release native accessibility resources.
Cancel timed recording and Android polling on process signals, preserve completed results
when cleanup fails, and resolve screenshot, OCR, and template paths against the selected
workspace. Prevalidate conditional visual arguments and skill destination boundaries.
