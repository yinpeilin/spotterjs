# Scenario Adaptation Plan

Base: `master` at `cdbfc19a7e9571645b570be2f3cf7bfcacd0dd8a`.
The remote default branch and existing local changes were checked before work.
The older `main` and separate `launch/mit-readme` branches are outside this change.

## Scenario Matrix

| Scenario | Existing capability | Problem to verify | Scoped change | Verification |
|----------|---------------------|-------------------|---------------|--------------|
| Desktop scripts waiting for a visual control | Window capture and synchronous template polling | Window wait catches permanent failures and accepts non-finite timeouts | Validate wait timing and retry only template-not-found errors | Native mocks for match, timeout, invalid arguments and permanent failure; read-only Windows capture example |
| Agent CLI observes a cropped screenshot, then interprets coordinates | Workspace PNG artifacts with original and preview dimensions | Screen-region artifacts omit the screen origin | Add screen origin and coordinate-space metadata without changing existing fields | Adapter regression tests and real Windows regional capture |
| OCR initialization fails temporarily, then an embedding retries | Lazy model creation shared by CLI tools | A rejected initialization promise stays cached | Evict failed initialization while retaining successful and in-flight reuse | Failure/recovery and concurrent initialization tests; injected-engine OCR example, without claiming real model accuracy |
| Android companion rejects pairing, uses another protocol, or stops replying | Protocol-v2 WebSocket client and serialized requests | Failed handshakes may leak connections; late replies can be mistaken for a subsequent response | Close failed sessions, reject later queued requests, and require explicit reconnect after ambiguous transport failure | Local WebSocket protocol tests and a runnable protocol example; no real-device support claim |

## Delivery Stages

1. Review and commit the previous source-checkout repair, including the bundled
   Skill setup instructions. Push the branch and open a draft PR against `master`.
2. Add failing regressions for the selected scenario problems. Implement small,
   compatible fixes and executable examples. Update the matching English/Chinese
   guides and bundled Skill where CLI behavior changes. Add package changesets.
3. Run affected tests, TypeScript builds/types, documentation checks and clean
   local CLI installation checks. Keep Windows read-only smoke checks separate
   from protocol/engine fixtures. Commit and push the scenario changes.
4. Verify remote branch SHA and PR checks for each pushed commit. Resolve failures
   introduced by this work; report unavailable CI or missing credentials exactly.

## Boundaries

- No default-branch push, merge, npm release, license change or breaking API change.
- No new external service permissions or automatic retries of desktop/device actions.
- Windows x64 is the available native host. Linux/X11, other Node versions, real
  Android hardware and real OCR model integration remain explicitly unverified
  unless suitable environments become available during this task.
- Keep unrelated user changes intact. Update this plan with observed results and
  any narrower scope chosen after reproducing the problems.

## Observed Progress

- The source-checkout repair is committed as `7c79c0a`, including the previously
  missed bundled Skill setup instructions. A non-force push to the new branch
  was attempted and failed before authentication: Git reported that no password
  could be obtained with interactivity disabled. No remote branch was written;
  a draft PR and commit-specific CI checks cannot yet be created or inspected.
- New regressions reproduced permanent-error swallowing/invalid wait timing,
  missing capture origins, rejected OCR caches, leaked Android handshake sockets,
  and a late acknowledgement incorrectly completing the next queued action.
- Small fixes now cover those paths. Successful and in-flight OCR caches remain
  shared; an existing static OCR import is reused instead of a redundant dynamic
  import. Android actions are never automatically retried.
- Added read-only desktop/CLI/Android examples and an injected OCR geometry
  example. `smoke:scenarios` ran the OCR example and Android observation example
  against a local protocol fixture successfully. Real Android devices and OCR
  model inference remain unverified.
- Final `npm test` passed: 330 TypeScript tests passed, one real OCR integration
  test skipped, plus Rust tests and public API type checks. All TypeScript
  workspaces built. Scenario TypeScript examples passed strict type checks;
  the Windows desktop observer and a real 8x8 CLI region capture ran successfully.
- The clean temporary CLI install verifier passed, including the new nonzero
  region origin, native loading, Unicode JSON, sequences and Skill installation.
  Documentation and whitespace checks passed. Authentication remains the only
  delivery blocker; no PR or remote CI result is claimed.
