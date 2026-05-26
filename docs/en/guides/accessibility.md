# Accessibility Automation Guide

[中文文档](../../zh-CN/guides/accessibility.md)

Accessibility automation works best for structured controls such as text
fields, buttons, menus, and list items. Windows uses UI Automation (UIA), and
Linux uses AT-SPI2.

## When to Use It

- You need to find elements by control name, type, state, or automation ID.
- Template images are fragile across themes, scaling, or languages.
- You need to dump the UI tree to understand an application.

Template matching is better for visually stable icons or regions. Accessibility
is better for semantically stable controls. Robust scripts often combine both.

## Quick Flow

```typescript
import { accessibility, desktop } from "@spotterjs/core";

accessibility.quick.enable({ eventSubscription: true });

const win = desktop.waitForWindow("Notepad", 10_000);
const rootId = accessibility.quick.attach(win.id);
const editId = accessibility.quick.find(rootId, {
  controlType: "Edit",
});

accessibility.quick.click(editId);
```

## Query Elements

```typescript
const buttonId = accessibility.quick.waitFor(
  rootId,
  { controlType: "Button", name: "OK" },
  5000
);

accessibility.quick.invoke(buttonId);
```

Common query fields:

| Field | Purpose |
|-------|---------|
| `name` | Visible accessible name |
| `controlType` | Platform control type such as `Button`, `Edit`, or `ListItem` |
| `automationId` | Stable automation ID exposed by the app |
| `nameContains` | Convenience substring query |

## Dump the UI Tree

Dump the tree first when a query misses:

```typescript
const tree = accessibility.debug.dumpTree(rootId, {
  treeView: "control",
});

console.log(tree);
```

`treeView` values:

| Mode | Purpose |
|------|---------|
| `control` | Recommended daily automation view |
| `content` | Focus on content nodes |
| `raw` | Full raw tree for low-level diagnostics |
| `auto` | Let the native layer choose a platform-appropriate view |

## Diagnostics

```typescript
const report = accessibility.debug.attachWindowReport(win.id);
const info = accessibility.debug.getElementInfo(buttonId);
const health = accessibility.debug.treeHealth(rootId);
```

Check whether the attach step found the intended window, whether the tree is
empty or unexpectedly small, whether the element supports the pattern you want,
and whether its bounds are inside the target window.

## Platform Notes

- Windows UIA works well with many Win32, WPF, and UWP apps, but custom-drawn UIs may expose limited nodes.
- Linux requires the application and desktop environment to expose AT-SPI2.
- Electron, browsers, and cross-platform UI frameworks can expose very deep trees, so keep queries specific.

## Examples

Paint UI tree examples:

```bash
npm run example:paint:ui-tree
npm run example:paint:ui-query
```

More scripts are listed in the [examples map](../examples.md).
