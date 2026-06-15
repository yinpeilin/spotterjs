# @spotterjs/node

Node.js native addon (napi-rs) for spotterjs. TypeScript definitions are auto-generated (`index.d.ts` via `npm run build`).

## Capabilities

| Area | N-API examples |
|------|----------------|
| Screen | `getScreenSize`, `captureScreen`, `captureWindow` |
| Match | `findTemplate(path, needleBuffer?, opts?)`, `findAllTemplates`, `waitForTemplate`, `findTemplateBuffers` |
| Window match | `findTemplateInWindow`, `findAllTemplatesInWindow` (optional `needleBuffer`) |
| Window | `listWindows`, `getActiveWindow`, `focusWindow`, `moveWindow`, `resizeWindow` |
| Desktop apps | `listDesktopApps`, `findDesktopApps`, `findWindowsByTitle`, `waitForWindowByTitle` |
| Image | `loadImageFromPath`, `loadImageFromBuffer`, `getImageSize`, `encodeCapturePng` |
| Input | `mouseMove`, `mouseClick`, `setMouseConfig`, `keyboardTypeText`, `clipboardGet` |
| Accessibility | `accessibilityEnable`, `accessibilityFind`, `accessibilityInvoke` |

Platform binaries are installed through optional npm packages:

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

Prefer [`@spotterjs/core`](../../packages/core) (`screen`, `windows`, `mouse`, `keyboard`, `image`) over calling this package directly.

See [docs/MATCHING.md](../../docs/MATCHING.md) for template matching usage.

## License

See [LICENSE](../../LICENSE).
