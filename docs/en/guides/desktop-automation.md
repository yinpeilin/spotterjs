# Desktop Automation Guide

[中文文档](../../zh-CN/guides/desktop-automation.md)

`@spotterjs/core` is the main desktop automation entrypoint. It covers screen
capture, windows, mouse input, keyboard input, clipboard access, template
matching, and coordinate conversion.

## Common Imports

```typescript
import {
  clipboard,
  desktop,
  keyboard,
  mouse,
  screen,
  windows,
} from "@spotterjs/core";
```

## Window Workflow

```typescript
const win = desktop.waitForWindow("Notepad", 10_000);
windows.focus(win.id);

const active = windows.active();
console.log(active.title, active.region);
```

Prefer window-scoped automation when the target window is stable. It reduces
false matches and avoids scanning the whole screen.

```typescript
const match = windows.findTemplate(win.id, "./assets/save.png", {
  confidence: 0.9,
});

windows.tapTemplate(win.id, "./assets/save.png", { confidence: 0.9 });
console.log(match.center);
```

Window template APIs still return screen coordinates, so the result can be
passed directly to `mouse.tap`.

## Capture and PNG Encoding

```typescript
const cap = screen.capture();
const regionCap = screen.capture({ left: 0, top: 0, width: 800, height: 600 });
```

Use the image facade when you need to save, upload, log, or pass captures
through JSON/MCP:

```typescript
import { image } from "@spotterjs/core";

const bytes = image.encode(cap);
const base64 = image.encodeBase64(cap);
```

## Mouse, Keyboard, and Clipboard

```typescript
mouse.move(200, 300);
mouse.click("left");
mouse.tap(200, 300);

keyboard.write("hello");
keyboard.hotkey(["Ctrl", "V"]);

clipboard.set("text from spotterjs");
const text = clipboard.get();
```

`keyboard.up()` releases only keys previously recorded by `keyboard.down()`.
Use raw key APIs only when you understand the current desktop state.

## Template Matching

```typescript
const found = await screen.find("./button.png", {
  confidence: 0.9,
  region: { left: 100, top: 80, width: 900, height: 600 },
  scale: { min: 0.8, max: 1.2 },
});

mouse.tap(found.center.x, found.center.y);
```

High-level matching APIs return screen coordinates. `region` limits the search
area but does not rebase returned coordinates.

For deeper matching details, see [Template matching](../MATCHING.md).

## Coordinate Spaces

| Space | Common source | Meaning |
|-------|---------------|---------|
| Screen coordinates | `screen.find`, `screen.capture`, `windows.findTemplate` | Origin is the desktop’s top-left corner |
| Window-local coordinates | Coordinate helpers and some window-local reasoning | Origin is the window frame or captured window area |

Use `toMatchBox` and `matchTapScreen` when you need to store both screen and
window-local views of a match:

```typescript
import { matchTapScreen, toMatchBox } from "@spotterjs/core";

const box = toMatchBox(win.region, found.region);
const point = matchTapScreen(box);
mouse.tap(point.x, point.y);
```

## Practical Advice

- Prefer window-scoped matching before full-screen matching.
- Use a reasonable `confidence`; low thresholds hide poor template quality.
- Verify input, click, and focus behavior on Paint or Notepad before automating real applications.
- Put scripts that modify real data under `scripts/integration/` and document the risk.
