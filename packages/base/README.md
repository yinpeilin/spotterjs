# @spotterjs/base

spotterjs 各包的**共享 TypeScript 类型**与工具函数。

通常作为 `@spotterjs/core` 的依赖安装，也可单独引用类型。

## 导出

| 符号 | 说明 |
|------|------|
| `Region` | 屏幕矩形（left/top/width/height，像素） |
| `Point` | 屏幕坐标点 |
| `CaptureImage` | RGBA 截图 buffer + 宽高 |
| `MatchOptions` | 模板匹配参数（confidence、searchRegion、multiScale 等） |
| `WindowInfo` | 顶层窗口元信息 |
| `DesktopApp` | 按进程聚合的应用与窗口列表 |
| `MatchProvider` | `find` / `findAll` / `waitFor` 接口 |
| `centerOf(region)` | 计算区域几何中心 |

## 坐标约定

- 所有 `Region` / `Point` 默认使用**屏幕坐标**（主显示器左上角为原点）。
- 窗口内匹配 API（`findInWindow` 等，见 `@spotterjs/core`）返回结果同样为屏幕坐标。

IDE 悬停可查看各字段的 JSDoc 说明。

## License

See [LICENSE](../../LICENSE).
