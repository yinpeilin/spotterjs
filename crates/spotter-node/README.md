# @spotter-rs/node

Node.js native addon (napi-rs) for Spotter. TypeScript definitions are **auto-generated** (`index.d.ts` via `npm run build`).

## Capabilities

| Area | N-API examples |
|------|----------------|
| Screen | `getScreenSize`, `captureScreen`, `captureWindow` |
| Match | `findTemplate(path, needleBuffer?, opts?)`, `findAllTemplates`, `waitForTemplate`, `findTemplateBuffers` |
| Window match | `findTemplateInWindow`, `findAllTemplatesInWindow` (optional `needleBuffer`) |
| Window | `listWindows`, `getActiveWindow`, `focusWindow`, `moveWindow`, `resizeWindow`, … |
| Desktop apps | `listDesktopApps`, `findDesktopApps`, `findWindowsByTitle`, `waitForWindowByTitle` |
| Input | `mouseMove`, `mouseClick`, `setMouseConfig`, `keyboardTypeText`, `clipboardGet`, … |
| Accessibility | `accessibilityEnable`, `accessibilityFind`, `accessibilityInvoke`, … |

Platforms (prebuilt on publish): `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`.

Prefer [`@spotter/core`](../packages/core) (`screen`, `mouse`, `windowApi`, …) over calling this package directly.

See [docs/MATCHING.md](../../docs/MATCHING.md) for template matching usage.

## License

See [LICENSE](../../LICENSE).
