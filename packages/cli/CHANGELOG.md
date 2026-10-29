# @spotterjs/cli

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
