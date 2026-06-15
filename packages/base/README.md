# @spotterjs/base

Shared TypeScript types, error helpers, and small geometry utilities for the
spotterjs packages.

Most users get this package through `@spotterjs/core`, but it can be installed
directly when you need public types for integrations, plugins, or tests.

中文文档：本包的类型说明与坐标约定也适用于中文指南中的 `@spotterjs/core`、MCP 和 OCR 示例。

## Install

```bash
npm install @spotterjs/base
```

## Exports

| Symbol | Purpose |
|--------|---------|
| `Region` | Rectangle with `left`, `top`, `width`, and `height` in pixels |
| `Point` | Two-dimensional pixel coordinate |
| `CaptureImage` | Raw RGBA capture buffer with width and height |
| `TemplateImage` | Template image input: image path or encoded PNG/JPEG/WebP `Buffer` |
| `MatchOptions` | Template matching options such as `confidence`, `region`, and `scale` |
| `MatchWaitOptions` | Wait options with `timeoutMs` and optional `intervalMs` |
| `MatchResult` | Template match result with `region`, `center`, `score`, and `matchScore` |
| `MatchScore` | Normalized matching score shared by visual and OCR text matching |
| `TextMatchEvaluation` | OCR text-match diagnostics |
| `WindowInfo` | Top-level desktop window metadata |
| `DesktopApp` | Process-grouped desktop app and window metadata |
| `MatchProvider` | `find` / `findAll` / `waitFor` provider interface |
| `SpotterError` | Structured error with stable `code`, optional `domain`, and `context` |
| `isSpotterError(error)` | Type guard for spotterjs structured errors |
| `toSpotterError(error)` | Convert unknown errors into `SpotterError` |
| `centerOf(region)` | Return the integer center point of a region |

## Coordinate Conventions

Desktop `Region` and `Point` values use screen coordinates unless an API
explicitly documents a local coordinate space. The screen origin is the desktop
top-left corner.

Window-scoped APIs such as `windows.findTemplate` also return screen
coordinates, so their centers can be passed directly to `mouse.tap`.

`image.find` returns coordinates relative to the provided capture. Android
plugin APIs use Android device screenshot coordinates.

## Error Conventions

spotterjs packages throw `SpotterError` for structured failures. Application
code should branch on `isSpotterError(error)` and then use stable
`SPOTTER_<DOMAIN>_<REASON>` codes.

```typescript
import { isSpotterError } from "@spotterjs/base";

try {
  // call a spotterjs API
} catch (error) {
  if (isSpotterError(error)) {
    console.log(error.code, error.domain, error.context);
  }
}
```

Hover exported types in your IDE for detailed JSDoc on each field.

## License

See [LICENSE](../../LICENSE).
