# spotterjs CLI + Skill (`@spotterjs/cli`)

[中文文档](../zh-CN/CLI.md)

Run desktop, Android companion, OCR, and workspace operations directly from a
shell. Each invocation accepts JSON arguments, writes one JSON result to stdout,
and exits. Agents can install the bundled Skill to learn the command workflow.

## Install and verify

For a published release:

```bash
npm install -g @spotterjs/cli
spotterjs --version
spotterjs --help
spotterjs list
spotterjs schema desktop_capture_screen
spotterjs run desktop_list_windows
```

Use `npx @spotterjs/cli` in place of `spotterjs` when a global installation is
not wanted. For an unpublished source checkout, build and run the local entry:

```bash
npm ci
npm run build:native
npm run build:ts
node packages/cli/dist/cli.js list
node packages/cli/dist/cli.js run desktop_list_windows
```

The first source build requires Rust and platform build tools. On Linux x64,
replace `npm run build:native` with `npm run build:linux -w @spotterjs/node`.
See [source setup](./getting-started.md#source-checkout).

Native binary changes require `npm run build:native`. Desktop automation needs
an unlocked interactive Windows or Linux desktop.

## Install the agent Skill

The package includes `skills/spotterjs/SKILL.md` and its command reference.
Print its location or copy it into an agent's skills directory:

```powershell
spotterjs skill path
# Codex
spotterjs skill install --target "$env:USERPROFILE\.codex\skills"
# Claude Code
spotterjs skill install --target "$env:USERPROFILE\.claude\skills"
```

The target is the parent skills directory; the installer creates `spotterjs/`
inside it. In a source checkout, replace `spotterjs` with
`node packages/cli/dist/cli.js`. The Skill teaches discovery, schema inspection,
observe–act–verify, JSON input, coordinates, and session lifetime.
Existing installs are preserved unless `--force` is explicitly passed to replace them.

## JSON input and results

Discover a command's current fields before running it:

```bash
spotterjs schema desktop_capture_screen
spotterjs run desktop_capture_screen --json '{"detail":"original"}'
spotterjs run desktop_capture_screen --file capture.json
```

Choose one of `--json`, `--file`, or `--stdin`. Commands without arguments may
omit all three. `--workspace` selects the workspace root for host files and
capture artifacts:

```bash
spotterjs --workspace ./test-output run host_list_dir
```

For Unicode, multiline text, quotes, or shell metacharacters, prefer a UTF-8 file
over inline shell quoting. This PowerShell example preserves the text exactly:

```powershell
$payload = @{ text = "你好 😀 !@#`nSecond line"; mode = 'native' } | ConvertTo-Json
$utf8 = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText((Join-Path $PWD 'input.json'), $payload, $utf8)
spotterjs run desktop_keyboard_type --file input.json
```

In a UTF-8 shell, stdin is also supported:

```bash
printf '%s' '{"detail":"original"}' | spotterjs run desktop_capture_screen --stdin
```

Success:

```json
{ "success": true, "data": { "imagePath": ".spotter/artifacts/example.png" } }
```

Failure uses a nonzero process exit code and `success: false`:

```json
{
  "success": false,
  "error": {
    "message": "ocr_find_text failed: OCR text not found: Send",
    "code": "SPOTTER_OCR_TEXT_NOT_FOUND",
    "domain": "ocr",
    "context": { "text": "Send", "exact": true }
  }
}
```

`code`, `domain`, and `context` are present when the underlying error provides
them. Treat an input timeout as an unknown outcome; inspect the target before
retrying clicks, typing, or other actions.

## Command discovery

`list` reports enabled commands and their schemas. `list --all` includes optional
capabilities for discovery. Enable the relevant capability before execution:

- Desktop: `desktop_list_windows`, `desktop_list_apps`,
  `desktop_get_active_window`, `desktop_focus_window`, `desktop_capture_screen`,
  `desktop_capture_window`, `desktop_capture_active`, `desktop_mouse_*`,
  `desktop_keyboard_type`, `desktop_keyboard_tap`, `desktop_clipboard_*`.
- Vision: `desktop_find_template`, `desktop_capture_and_ocr`,
  `desktop_capture_and_find_template`, `desktop_find_template_and_tap`, plus
  image/color operations shown by `list`.
- OCR: `ocr_read_image`, `ocr_find_text`.
- Accessibility (`SPOTTERJS_A11Y=1`): prefer `desktop_a11y_inspect` and
  `desktop_a11y_action`. Low-level attach/find/dump/invoke commands use
  process-local IDs and are intended for an in-process API workflow.
- Android (`SPOTTERJS_ANDROID=1`): `android_connect`, `android_list_devices`,
  `android_status`, `android_current_app`, `android_launch_app`,
  `android_capture_screen`, `android_tap`, `android_swipe`, `android_gesture`,
  `android_text`, `android_keyevent`, `android_back`, `android_home`,
  `android_dump_tree`, `android_find_element`, `android_wait_for_element`,
  `android_tap_element`, `android_type_element`, and template commands.
- Recording (`SPOTTERJS_RECORDING=1`): use `desktop_record_input` to record for
  a fixed duration and return a completed script, and `desktop_play_recording`
  to replay. Low-level `desktop_start_recording`/`desktop_stop_recording` are
  for an in-process API workflow; separate invocations do not share a recording.
- Workspace: `host_read_file`, `host_write_file`, `host_list_dir`, `host_stat`,
  `host_open_file`, `host_shell_info`, `host_exec`.

## Recommended desktop workflow

1. List windows and choose the target window ID.
2. Focus it, then capture the window or inspect it with OCR, matching, or accessibility.
3. Act on an observed target.
4. Capture or read state again to verify the result.

For live vision, use `desktop_capture_and_ocr` or
`desktop_capture_and_find_template` to inspect one captured frame. Use
`desktop_find_template_and_tap` when the match itself determines the click; it
only taps after a successful match. Pass `debugImage: true` for an annotated PNG.
See [Desktop automation](./guides/desktop-automation.md) and [OCR](./guides/ocr.md).

## Accessibility without carrying process-local IDs

`desktop_a11y_inspect` takes `windowId`, optional `maxDepth`, `treeView`, and
`query`. It attaches and inspects the tree in one invocation, returning
`data.windowId`, `data.tree`, and `data.elementInfo` when queried.
With a query, the tree is the matching element's subtree.
`desktop_a11y_action` takes `windowId`, a required nonempty `query`, optional
`maxDepth`, and an `action`. It attaches, finds the target, and acts in the same
process. Enable accessibility and inspect both schemas first:

```powershell
$env:SPOTTERJS_A11Y = '1'
spotterjs schema desktop_a11y_inspect
spotterjs schema desktop_a11y_action
spotterjs run desktop_a11y_inspect --file inspect.json
```

`inspect.json`, with a window ID observed from `desktop_list_windows`:

```json
{ "windowId": "<observed-window-id>", "maxDepth": 12 }
```

After inspecting the tree, save an action for an observed editable search field
as `action.json`:

```json
{
  "windowId": "<observed-window-id>",
  "query": { "controlType": "Edit", "nameContains": "Search" },
  "action": { "type": "type", "text": "中文输入测试 😀" }
}
```

Replace the example window ID and search selector with values from the target.
Run `spotterjs run desktop_a11y_action --file action.json`, then inspect or
capture to verify the result. `type` sets the selected element's value through
its accessibility provider. Other actions are `{ "type": "click" }` and
`{ "type": "invoke" }`.

Selectors support `name`, `nameContains`, `controlType`, `automationId`, and
optional `match: "exact" | "contains"`; fields combine with AND. Use a selector
specific enough to identify the intended control. Low-level commands such as
`desktop_a11y_attach_window`, `desktop_a11y_find`, and `desktop_a11y_invoke` retain
their `rootId`/`elementId` API for workflows within one process. Those IDs do not
survive CLI exit, and literal sequence steps cannot pass returned IDs to later
steps. Use self-contained inspect/action commands for CLI or TypeScript APIs
for dynamic ID-based workflows.

## Recording in one CLI process

`desktop_record_input` starts recording, waits for the requested duration, stops,
and returns `data.script` plus `data.scriptJson`:

```powershell
$env:SPOTTERJS_RECORDING = '1'
spotterjs schema desktop_record_input
spotterjs run desktop_record_input --json '{"durationMs":5000}'
```

`durationMs` is required (1–300000 ms), and `moveThrottleMs` is optional. The
command waits while the user performs the input to record. For playback, put
the returned `data.script` in a JSON object's `script` field, optionally add
`speed`, then run `spotterjs run desktop_play_recording --file playback.json`.
Inspect `schema desktop_play_recording` first. The full recording
response envelope is not a playback argument object. Separate start and stop
CLI invocations cannot share recording state.

## Capture artifacts and coordinates

Screenshots are PNG files under `.spotter/artifacts` in the selected workspace.
`data.imagePath` is workspace-relative. Standalone captures default to
`detail: "high"`, which downsizes images whose long edge exceeds 1600 pixels.
Use `detail: "original"` for OCR, small text, and pixel-level positioning.
Visual combo and Android captures default to `original`.

Desktop vision results use `coordinateSpace: "screen"`; Android results use
`coordinateSpace: "android-device"`. A desktop window result includes its
`origin`, and matching/OCR coordinates are translated to screen coordinates.
Do not use a downscaled preview pixel as a screen coordinate without converting
it to the original size and adding the capture origin. `region` limits a screen
capture; `source: "window"` requires `windowId` and captures the full window.

## Sequences and Android sessions

Use `spotterjs sequence --file plan.json` for related operations. The file is an
array of `{ "name": "command_name", "arguments": {} }` steps (1–100).
Arguments for the entire plan are validated before any action. Steps run in
order and execution stops on the first failure; completed actions are not rolled
back or automatically replayed. See [Sequences](./guides/sequences.md).

Android `deviceId` connections and accessibility/recording state are local to
the running process. To connect a phone and reuse its ID, put the connect and
follow-up actions in one sequence. For separate Android invocations, pass
`url` and `sessionToken` for each action. Pairing returns a token for later
authenticated reconnects; persist it securely. See [Android companion](./guides/android-companion.md).

## Environment and host boundaries

- `SPOTTERJS_WORKSPACE_ROOT`: workspace root; defaults to the current directory;
  `--workspace` selects it explicitly.
- `SPOTTERJS_ALLOW_SHELL=1`: opt in to `host_exec`; disabled by default.
- `SPOTTERJS_FS_MAX_BYTES`: file read/write and command stream limit, default 1048576.
- `SPOTTERJS_EXEC_TIMEOUT_MS`: default shell timeout, default 60000.
- `SPOTTERJS_SHELL`: override the host shell executable.
- `SPOTTERJS_A11Y`, `SPOTTERJS_ANDROID`, `SPOTTERJS_RECORDING`: enable optional
  capabilities with `1` or `true`.

Host file paths must stay inside the workspace. Writes to sensitive paths such
as `.env` and `credentials.json` are denied by default. Use `host_shell_info` to
inspect the selected shell. Vision input image paths follow their individual
command schemas; the workspace host-file boundary is not an operating-system
sandbox for desktop or Android actions.

## Local verification

```bash
npm run build:ts
npm run test -w @spotterjs/cli
npm run docs:check
node packages/cli/dist/cli.js list --all
node packages/cli/dist/cli.js run host_shell_info
node packages/cli/dist/cli.js run desktop_list_windows
```
