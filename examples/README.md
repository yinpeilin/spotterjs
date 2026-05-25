# spotterjs examples

这些示例是小型可运行脚本，用真实桌面流程展示 `@spotterjs/core` API。总览见 [文档示例地图](../docs/examples.md)。

## Paint

Paint 示例使用 Windows Paint 作为相对安全的演示目标：

```bash
npm run examples:paint
```

单步运行：

```bash
npm run example:paint:open-focus
npm run example:paint:capture
npm run example:paint:match-tool
npm run example:paint:click-tool
npm run example:paint:input
npm run example:paint:ui-tree
npm run example:paint:ui-query
```

输出写入 `test-output/examples/`。脚本可能打开 Paint、聚焦窗口、移动鼠标、点击匹配到的工具，并绘制后撤销一小段演示笔画。它们不会保存文件，也不会覆盖用户文档。

模板文件：

```text
examples/paint/assets/tool-template.png
```

匹配范围会限制在 Paint 顶部工具栏，避免选中工具后浮层中的同类图标抢走匹配。

如果 Windows 主题、Paint 版本或显示缩放改变了工具栏图标，请用新的工具栏截图替换模板。只有需要缩放容忍时才设置 `SPOTTERJS_PAINT_MULTISCALE=1`；默认使用精确尺寸匹配，以降低相邻工具误匹配。

UI 树示例使用 Windows UI Automation：

- `example:paint:ui-tree` 会写入 `test-output/examples/paint-ui-tree.json` 和 `paint-ui-tree-object.json`。
- `example:paint:ui-query` 展示 `accessibility.quick.find()` 和 `accessibility.debug.getElementInfo()`。默认只报告匹配元素；设置 `SPOTTERJS_PAINT_UIA_CLICK=1` 后才会点击。

设置 `SPOTTERJS_PAINT_TREE_VIEW=raw`、`control`、`content` 或 `auto` 可以比较不同 UIA tree walker。默认值是 `control`。
