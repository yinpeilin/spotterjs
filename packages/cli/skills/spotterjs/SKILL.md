---
name: spotterjs
description: Automate Windows or Linux desktop applications and Android companion devices through the spotterjs CLI. Use for window discovery, screenshots, keyboard and mouse input, accessibility, OCR, template matching, and verified desktop or Android workflows.
---

# spotterjs CLI automation

Use the local `spotterjs` executable to observe and operate a user's desktop or
paired Android companion. Each invocation receives JSON and returns JSON. Keep
the user's intended target and authorized action explicit.

## Locate the executable and discover commands

1. Try `spotterjs --version` and `spotterjs --help`.
2. In a source checkout, use `node packages/cli/dist/cli.js`. On the first build,
   run `npm ci`, `npm run build:native`, then `npm run build:ts`; native build
   tools and Rust are required to generate the loader and type declarations.
   On Linux x64, use `npm run build:linux -w @spotterjs/node` instead of
   `npm run build:native` to enable X11. Later TypeScript-only changes can use
   `npm run build:ts` directly.
3. For an installed npm distribution, `npx @spotterjs/cli` is another entry point.
4. Run `spotterjs list`, then `spotterjs schema <command>` for exact arguments.
   Use `list --all` to discover optional capabilities. Never invent a command or
   field based on a similar library.

Enable only capabilities the task needs in the calling process's environment:
`SPOTTERJS_A11Y=1`, `SPOTTERJS_ANDROID=1`, `SPOTTERJS_RECORDING=1`.
`SPOTTERJS_ALLOW_SHELL=1` separately enables `host_exec` when the task needs it.

## Observe, act, verify

1. Run `spotterjs run desktop_list_windows` or `desktop_list_apps` and identify
   the target window from its title/process metadata.
2. Focus the intended window with `desktop_focus_window`. Inspect a capture,
   accessibility tree, OCR, or template match before selecting a target.
3. Act on an observed target. Prefer a stable semantic element or a successful
   visual match over an estimated coordinate.
4. Read state or capture again and verify the requested result.

Desktop examples, after inspecting each schema:

```bash
spotterjs run desktop_list_windows
spotterjs run desktop_capture_screen --json '{"detail":"original"}'
spotterjs run desktop_capture_and_ocr --json '{"source":"active","text":"Settings","debugImage":true}'
```

Choose `desktop_capture_and_find_template` to inspect a visual target and
`desktop_find_template_and_tap` when a successful match determines the click.
The latter only clicks after matching. Use `debugImage: true` for annotated
artifacts. A screenshot is evidence of a state, not proof a later action worked.

## Accessibility from independent CLI invocations

Prefer `desktop_a11y_inspect` and `desktop_a11y_action`, with `SPOTTERJS_A11Y=1`.
They take a window ID, attach to its tree, and resolve selectors within the same
invocation. Inspect before acting:

```bash
spotterjs schema desktop_a11y_inspect
spotterjs schema desktop_a11y_action
spotterjs run desktop_a11y_inspect --file inspect.json
spotterjs run desktop_a11y_action --file action.json
```

`inspect.json`:

```json
{ "windowId": "<observed-window-id>", "maxDepth": 12 }
```

After inspecting the tree, an editable search field could use `action.json`:

```json
{
  "windowId": "<observed-window-id>",
  "query": { "controlType": "Edit", "nameContains": "Search" },
  "action": { "type": "type", "text": "中文输入测试 😀" }
}
```

Replace the window ID and selector with observed values. Combine selectors to
identify the intended control; do not assume its accessible name is `Search`.
`query` accepts `name`, `nameContains`, `controlType`, `automationId`, and optional
`match: "exact" | "contains"`; fields combine with AND. An action needs a
nonempty selector. Supported actions are `click`, `invoke`, or `type` with
`text`. Type sets the selected element's value through its accessibility provider.
Inspect or capture again to verify the result. An inspect request can also
include `query` to return selected `elementInfo` and that element's subtree.

Low-level attach/find/dump/invoke commands that accept or return `rootId` or
`elementId` are for an in-process API workflow. Their IDs cannot be carried
between CLI invocations, and sequence steps do not substitute returned IDs.

## Record input within one invocation

With `SPOTTERJS_RECORDING=1`, use `desktop_record_input` to record for a fixed
duration, then stop and return `data.script` and `data.scriptJson` in one call:

```bash
spotterjs schema desktop_record_input
spotterjs run desktop_record_input --json '{"durationMs":5000}'
```

`durationMs` is required, from 1 to 300000; `moveThrottleMs` is optional. The CLI
waits while input is recorded. For playback, put the returned script into
`{ "script": <returned script>, "speed": 1 }` and pass the resulting JSON file
to `desktop_play_recording`. Inspect its schema before replaying.
Low-level `desktop_start_recording` and `desktop_stop_recording` are for an
in-process API workflow; separate CLI invocations cannot share a recording.

## Safe JSON and literal text

Use one input source: `--json '{...}'`, `--file args.json`, or `--stdin`.
No-argument commands may omit it. For Unicode, emoji, multiline text, quotes,
or shell metacharacters, write a UTF-8 JSON file and pass `--file`.

PowerShell:

```powershell
$payload = @{ text = "你好 😀 !@#`nSecond line"; mode = 'native' } | ConvertTo-Json
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $PWD 'input.json'), $payload, $utf8)
spotterjs run desktop_keyboard_type --file input.json
```

Native Unicode input is the default. Use explicit `mode: "paste"` when the
application requires paste; `pasteDelayMs` can accommodate slow paste handling.
Typing requires the intended editable control to have focus.

## JSON output and failures

Stdout contains one result: `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "message": "..." } }`. Failures exit nonzero.
Inspect `error.code`, `error.domain`, and `error.context` when present.
Keep diagnostics separate from parsed stdout.

Do not blindly repeat clicks, typing, submissions, or other actions after an
error or timeout. Observe target state first: the action may already have run.
Use the underlying error and current state to choose the next step.

## Artifacts and coordinates

Set `--workspace <directory>` or `SPOTTERJS_WORKSPACE_ROOT` deliberately.
Capture `data.imagePath` values are relative to that workspace, under
`.spotter/artifacts`; resolve them against the workspace before opening them.
Use `detail: "original"` for OCR and exact positioning. Standalone `high`
captures downscale long edges above 1600 pixels.

Desktop matching/OCR returns screen coordinates; Android uses device pixels.
Check `coordinateSpace`, capture dimensions, and `origin`. Do not click a pixel
from a downscaled preview without restoring its scale and capture origin.
Window combo commands already translate results into screen coordinates.

## Related steps and session lifetime

`spotterjs sequence --file plan.json` executes an array of 1–100
`{ "name": "command", "arguments": {} }` steps in one process. The entire
plan is validated before actions; execution stops at the first failure. Review
the completed count and failed index. Completed actions are not rolled back.

Android cached `deviceId` connections, accessibility IDs, and recording state
belong to one process. Separate CLI invocations do not share them. Put Android
connect and follow-up operations in one sequence, or pass `url` and
`sessionToken` on every independent action. Use unique device IDs for phones
within a sequence. Connections close when it finishes; protect returned tokens.

Sequences use literal arguments, without returned-value substitution. Use the
self-contained accessibility commands for CLI work. If a workflow must consume
an earlier result or retain dynamic state, use the `@spotterjs/core` or Android
TypeScript APIs in one process.
Do not concurrently run CLI processes that compete for the same desktop focus,
keyboard, or clipboard. The sequence queue is local to its process.

For command groups and examples, read [references/commands.md](./references/commands.md).
