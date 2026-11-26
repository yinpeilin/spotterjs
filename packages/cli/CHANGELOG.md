# @spotterjs/cli

## 1.1.2

### Patch Changes

- Improve structured error diagnostics and human-friendly hints across all packages:

  - Add optional `hint`, `formatSpotterError()`, and `diagnoseNativeAddonError()` in `@spotterjs/base` to pinpoint Windows Win32 error 126 missing VC++ runtime or sibling DLL issues, `.asar` packaging issues, architecture mismatches, and Linux shared library / glibc failures.
  - Wrap `onnxruntime-node`, ONNX session/inference, and `sharp` loading in `@spotterjs/plugin-ocr` with actionable `SpotterError` codes (`SPOTTER_OCR_RUNTIME_LOAD_FAILED`, `SPOTTER_OCR_ONNX_SESSION_FAILED`, `SPOTTER_OCR_SHARP_LOAD_FAILED`), surface underlying `fetch failed` causes, add recognized-line samples to `SPOTTER_OCR_TEXT_NOT_FOUND`, and evict failed OCR engine promises from cache.
  - Attach actionable hints for all `SPOTTER_NATIVE_*` errors, native addon load failures, and host sandbox errors in `@spotterjs/core`, and companion connection/protocol/remote errors in `@spotterjs/plugin-android`.
  - Format Zod validation errors cleanly with `SPOTTER_CLI_INVALID_ARGUMENTS` and schema hints, preserve `hint`/`code`/`context` in top-level CLI errors, and evict failed CLI OCR client promises from cache.

- dec8599: Keep native Windows text input clipboard-free and ordered through SendInput. Use physical
  ASCII key events only when the standard US keyboard layout produces the exact requested text,
  otherwise retaining Unicode input. Pace Windows text by at least 1 ms per character even
  when zero delay is requested, while keeping the 10 ms default and hotkey timing unchanged.
  Explicit Windows paste now retains its clipboard payload
  instead of restoring previous text before a slow target may have consumed it. Document the
  platform-specific restoration behavior and avoid automatically replaying uncertain input.
- Updated dependencies
- Updated dependencies [dec8599]
  - @spotterjs/base@1.1.2
  - @spotterjs/core@1.1.2
  - @spotterjs/plugin-ocr@1.1.2
  - @spotterjs/plugin-android@1.0.7

## 1.1.1

### Patch Changes

- 7cf0c2f: Adopt the Apache-2.0 license to allow commercial use, modification, redistribution,
  and integration into proprietary products without separate commercial authorization.
  Update package license metadata and bundled license texts; third-party dependencies
  and OCR models remain subject to their own terms.
- Updated dependencies
- Updated dependencies [7cf0c2f]
  - @spotterjs/base@1.1.1
  - @spotterjs/core@1.1.1
  - @spotterjs/plugin-ocr@1.1.1
  - @spotterjs/plugin-android@1.0.6

## 1.1.0

### Minor Changes

- 7287ef5: Replace the protocol server package with a standalone CLI and bundled agent skill.
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

### Patch Changes

- Updated dependencies [7287ef5]
- Updated dependencies [7287ef5]
- Updated dependencies [7287ef5]
  - @spotterjs/core@1.1.0
  - @spotterjs/plugin-ocr@1.1.0

## Unreleased

- Introduce the standalone `spotterjs` executable with JSON input and results,
  command discovery, JSON schemas, validated sequences, and nonzero failure exits.
- Preserve desktop, OCR, Android companion, workspace, and recording capabilities.
- Add self-contained accessibility inspection/actions and fixed-duration input recording
  so independent CLI invocations do not depend on process-local IDs or recording state.
- Bundle an installable agent Skill with Unicode text, coordinate, and session guidance.
- Replace the retired protocol integration with CLI + Skill; this package does not
  yet have a published release history.
