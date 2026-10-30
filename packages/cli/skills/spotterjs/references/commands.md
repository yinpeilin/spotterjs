# Command reference and plan examples

Use `spotterjs list` and `spotterjs schema <command>` as the current source of
truth for arguments, defaults, and enabled commands.

## Command groups

- Discovery: `desktop_list_windows`, `desktop_list_apps`, `desktop_get_active_window`.
- Window focus/capture: `desktop_focus_window`, `desktop_capture_screen`,
  `desktop_capture_window`, `desktop_capture_active`.
- Input: `desktop_mouse_move`, `desktop_mouse_click`, `desktop_mouse_tap`,
  `desktop_keyboard_type`, `desktop_keyboard_tap`, `desktop_clipboard_get`,
  `desktop_clipboard_set`.
- Vision: `desktop_find_template`, `desktop_capture_and_ocr`,
  `desktop_capture_and_find_template`, `desktop_find_template_and_tap`.
- Saved-image OCR: `ocr_read_image`, `ocr_find_text`.
- Recording: `desktop_record_input` records for a fixed duration and returns the
  completed script; `desktop_play_recording` replays it. Requires
  `SPOTTERJS_RECORDING=1`. Low-level `desktop_start_recording` and
  `desktop_stop_recording` are for one in-process API workflow.
- Accessibility: prefer `desktop_a11y_inspect` and `desktop_a11y_action` with
  `SPOTTERJS_A11Y=1`. They resolve the tree and query in one invocation. Low-level
  `desktop_a11y_attach_window`, `desktop_a11y_find`, `desktop_a11y_invoke`,
  `desktop_a11y_tap_element`, `desktop_a11y_dump_tree`, and
  `desktop_a11y_element_info` are for in-process API workflows; their IDs are
  process-local.
- Android: `android_connect`, `android_disconnect`, `android_list_devices`,
  `android_heartbeat`, `android_status`, `android_display_info`,
  `android_current_app`, `android_launch_app`, `android_capture_screen`,
  `android_tap`, `android_swipe`, `android_gesture`, `android_text`,
  `android_keyevent`, `android_back`, `android_home`, `android_dump_tree`,
  `android_find_element`, `android_wait_for_element`, `android_tap_element`,
  `android_type_element`, `android_find_template`,
  `android_find_template_and_tap`; requires `SPOTTERJS_ANDROID=1`.
- Workspace: `host_read_file`, `host_write_file`, `host_list_dir`, `host_stat`,
  `host_open_file`, `host_shell_info`, `host_exec`. Shell execution additionally
  requires `SPOTTERJS_ALLOW_SHELL=1`.

## Desktop plan

After discovering the window ID and confirming the editable target, save:

```json
[
  { "name": "desktop_focus_window", "arguments": { "windowId": "<observed-window-id>" } },
  { "name": "desktop_keyboard_type", "arguments": { "text": "Hello 😀\nSecond line" } },
  { "name": "desktop_capture_active", "arguments": { "detail": "original" } }
]
```

Replace `<observed-window-id>` with the observed window ID, then run
`spotterjs sequence --file plan.json`. Inspect the final capture to verify input.

## Accessibility inspection and action

Read `spotterjs schema desktop_a11y_inspect` and
`spotterjs schema desktop_a11y_action`. Replace the window ID below with the
observed ID, save as `inspect.json`, and run
`spotterjs run desktop_a11y_inspect --file inspect.json`:

```json
{ "windowId": "<observed-window-id>", "maxDepth": 12, "treeView": "auto" }
```

The result includes `windowId`, `tree`, and optional `elementInfo` when a query
is supplied. Select an observed editable control by name, control type, or
automation ID. An example `action.json` for a search field is:

```json
{
  "windowId": "<observed-window-id>",
  "query": { "controlType": "Edit", "nameContains": "Search" },
  "action": { "type": "type", "text": "中文输入测试 😀" }
}
```

Use the actual observed search label or automation ID, then run
`spotterjs run desktop_a11y_action --file action.json`. Action types are `click`,
`invoke`, and `type` (requires `text`). `type` sets the element's accessible value.
Query fields combine with AND; at least one nonempty selector is required.
Inspect the target again after acting. Never pass a prior invocation's root or
element IDs to a new command. Use TypeScript APIs in one process for dynamic
ID-based workflows.

## Recording

Enable `SPOTTERJS_RECORDING=1`, inspect the schema, then record input for five
seconds in one invocation:

```bash
spotterjs schema desktop_record_input
spotterjs run desktop_record_input --json '{"durationMs":5000}'
```

The required duration is 1–300000 ms; `moveThrottleMs` is optional. The result
contains `data.script` and `data.scriptJson`. To replay, put `data.script` in
the `script` field of `playback.json`, optionally set `speed`, and run
`spotterjs run desktop_play_recording --file playback.json`. A full recorded
CLI response is not itself a playback argument file. Separate start/stop
invocations do not share recording state.

## Android plan

The user must pair the companion and enable its required phone permissions.
Use `code` for first pairing or `sessionToken` for an authenticated reconnect.

```json
[
  { "name": "android_connect", "arguments": { "deviceId": "phone-1", "url": "ws://192.168.1.23:17341", "sessionToken": "saved-token" } },
  { "name": "android_launch_app", "arguments": { "deviceId": "phone-1", "packageName": "com.android.settings" } },
  { "name": "android_current_app", "arguments": { "deviceId": "phone-1" } },
  { "name": "android_capture_screen", "arguments": { "deviceId": "phone-1", "detail": "original" } }
]
```

Enable `SPOTTERJS_ANDROID=1` in the caller, then execute the plan. To invoke one
Android action in a new process, pass both `url` and `sessionToken`; a previous
process's `deviceId` cache no longer exists.

## Host boundaries

Screen/region capture responses carry screen `origin` plus original and output
dimensions. Restore preview scale before interpreting a point, or use original
detail and pass the origin into standalone OCR. Window combo tools perform
their own coordinate translation.

Android timeouts and protocol mismatches invalidate the connection and reject
queued actions. Inspect state before reconnecting; do not replay blindly.

Host file operations stay inside the selected workspace; sensitive writes are
denied by default. The host boundary is not an operating-system sandbox for
desktop actions. Inspect `host_shell_info` before using `host_exec` so command
syntax matches the selected shell. Prefer an existing native shell tool for
ordinary development commands when available.
