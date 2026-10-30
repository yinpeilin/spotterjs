# Choose a Workflow

[中文文档](../../zh-CN/guides/scenarios.md)

Build a source checkout first using [Getting started](../getting-started.md#source-checkout).
These examples distinguish a live desktop/device from deterministic fixtures.

| Goal | Entrypoint | Example and requirements |
|------|------------|--------------------------|
| Observe a desktop or a uniquely identified window | `screen`, `windows`, `image` | `npx tsx examples/scenarios/inspect-desktop.ts [title-substring]`; requires a supported desktop session, saves a PNG, performs no input |
| Consume a cropped screenshot from an agent | CLI JSON and artifact geometry | `node examples/scenarios/capture-region.mjs 3 5 8 8`; requires a supported desktop session, prints origin and a coordinate conversion |
| Verify OCR crop/coordinate handling offline | `createOcr({ engine })` | `npx tsx examples/scenarios/ocr-coordinates.ts`; injected text fixture, no model download or OCR accuracy claim |
| Inspect a paired Android device | Android companion API | `npx tsx examples/scenarios/inspect-android.ts`; needs protocol v2 and `SPOTTERJS_ANDROID_URL` / `SPOTTERJS_ANDROID_TOKEN`, reads display/app state and closes the session |

Run `npm run smoke:scenarios` for the OCR contract and the Android observation
example against a loopback WebSocket fixture. This does not test Android
permissions, an APK, a phone, or real OCR model inference.
The desktop examples capture the real desktop and write local artifacts. Supply
a narrow title substring: ambiguous or absent windows cause an error before
capture rather than selecting an arbitrary window.

## Screenshot coordinates

`desktop_capture_screen` returns `origin` and `coordinateSpace: "screen"` in
addition to existing dimensions. A region keeps its screen origin even if
`detail: "high"` creates a smaller preview. To map a preview point:

```typescript
const screenX = capture.origin.x + previewX * capture.originalWidth / capture.width;
const screenY = capture.origin.y + previewY * capture.originalHeight / capture.height;
```

For standalone `ocr_read_image` or `ocr_find_text`, use `detail: "original"` and
pass the capture's `origin` to translate image pixels into screen coordinates.
Standalone window captures do not supply an origin. Prefer
`desktop_capture_and_ocr` for window text already translated to screen coordinates.
Never treat a geometric example point as a detected control.

## Waiting and recovery

- `windows.waitForTemplate` retries template-not-found results. A missing window,
  unreadable template or capture failure is returned immediately. Zero timeout
  performs one observation; timing values must be finite and non-negative.
- Successful and in-flight OCR initialization is reused. Failed initialization
  is evicted so an explicit attempt can succeed after the model/provider problem
  is fixed. Actions and OCR requests are not automatically retried.
- Android protocol v2 has no request IDs. A timeout or unexpected reply closes
  the session and prevents queued commands from consuming a late reply. Observe
  device state and explicitly reconnect; do not blindly replay the action.

Windows x64 native capture was exercised for this change. Linux/X11, actual
Android devices and real OCR models still require their own environment checks.
