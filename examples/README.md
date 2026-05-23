# spotterjs examples

These examples are small, runnable scripts that show how to use the public
`@spotterjs/core` API in real desktop automation flows.

## Paint

The Paint examples use Windows Paint as a safe demo target:

```bash
npm run examples:paint
```

Run individual steps when learning or debugging:

```bash
npm run example:paint:open-focus
npm run example:paint:capture
npm run example:paint:match-tool
npm run example:paint:click-tool
npm run example:paint:input
npm run example:paint:ui-tree
npm run example:paint:ui-query
```

Outputs are written to `test-output/examples/`. The scripts may open Paint,
focus its window, move the mouse, click the matched tool, and draw then undo a
small demo stroke. They do not save files or overwrite user documents.

The template used by the matching examples lives at:

```text
examples/paint/assets/tool-template.png
```

Matching is scoped to Paint's top toolbar so the same icon in a floating tool
panel does not steal the match after the tool is selected.

If your Windows theme, Paint version, or display scaling changes the toolbar
icon appearance, replace that file with a fresh crop from your Paint toolbar.
Set `SPOTTERJS_PAINT_MULTISCALE=1` only when you need scale-tolerant matching;
the default is exact-size matching to avoid nearby toolbar false positives.

The UI tree examples use Windows UI Automation:

- `example:paint:ui-tree` attaches to Paint and writes
  `test-output/examples/paint-ui-tree.json` plus a structured
  `paint-ui-tree-object.json`.
- `example:paint:ui-query` shows `accessibility.quick.find()` and
  `accessibility.debug.getElementInfo()` against Paint. It only reports the
  matched element by default; set `SPOTTERJS_PAINT_UIA_CLICK=1` to click it.

Set `SPOTTERJS_PAINT_TREE_VIEW=raw`, `control`, `content`, or `auto` when you
want to compare different UIA tree walkers. The default is `control`.
