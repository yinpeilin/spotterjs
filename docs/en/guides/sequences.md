# CLI sequences for desktop and Android

[中文文档](../../zh-CN/guides/sequences.md)

Run related actions in one CLI process with `spotterjs sequence --file plan.json`.
This keeps Android connections and the action queue alive for the entire plan.
The CLI executes on the machine where it is started; it does not start a remote
worker or a network controller.

## Desktop example

First run `spotterjs run desktop_list_windows` and identify the target window.
Save a plan with that window's ID in `plan.json`:

```json
[
  { "name": "desktop_focus_window", "arguments": { "windowId": "123456" } },
  { "name": "desktop_keyboard_type", "arguments": { "text": "Hello 😀\nSecond line", "mode": "native" } },
  { "name": "desktop_capture_active", "arguments": { "detail": "original" } }
]
```

```bash
spotterjs sequence --file plan.json
```

Replace `123456` with the observed ID and ensure the intended editable control
has focus before typing. Native text input is the default; explicit paste mode
has a configurable `pasteDelayMs` for slow applications.

## Android session example

Enable Android commands, then keep connect and follow-up actions in one plan:

```powershell
$env:SPOTTERJS_ANDROID = '1'
spotterjs sequence --file phones.json
```

```json
[
  { "name": "android_connect", "arguments": { "deviceId": "phone-1", "url": "ws://192.168.1.23:17341", "sessionToken": "saved-token" } },
  { "name": "android_launch_app", "arguments": { "deviceId": "phone-1", "packageName": "com.android.settings" } },
  { "name": "android_current_app", "arguments": { "deviceId": "phone-1" } },
  { "name": "android_capture_screen", "arguments": { "deviceId": "phone-1", "detail": "original" } }
]
```

For first pairing, use `code` instead of `sessionToken` on the connect step.
Use a distinct `deviceId` for each phone. Connections close when the process
finishes; a later invocation can reconnect with the returned token. Protect plan
files containing tokens. For independent invocations, pass `url` and
`sessionToken` on each Android action instead of using a cached `deviceId`.

## Execution guarantees

- A plan contains 1–100 steps. Unknown commands and invalid arguments are rejected
  before the first action.
- Steps execute in order under one process's action queue. The first failure
  stops the plan and reports completed steps and the failed index.
- Completed actions are not rolled back or retried. Observe actual target state
  before resubmitting a failed or timed-out action.
- Separate CLI processes do not share a queue. Do not run concurrent processes
  that compete for one desktop's focus, keyboard, or clipboard.
- Steps use literal arguments; returned values are not automatically substituted
  into later steps. Use TypeScript APIs for dynamic branching, polling, or
  workflows that need to consume earlier output.

See [CLI + Skill](../CLI.md), [Desktop automation](./desktop-automation.md), and
[Android companion](./android-companion.md).
