# 示例地图

这个页面把仓库里的可运行示例和脚本串起来，方便按目标选择入口。

## Paint 示例

Paint 示例使用 Windows Paint 作为相对安全的桌面自动化目标：

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

输出目录：

```text
test-output/examples/
```

这些脚本可能打开 Paint、聚焦窗口、移动鼠标、点击匹配到的工具，并绘制后撤销一小段演示笔画。它们不会保存文件，也不会覆盖用户文档。

更多说明见 [examples/README.md](../examples/README.md)。

## Smoke 脚本

Smoke 脚本用于开发机本地验证：

```bash
npm run smoke
npm run smoke:version
npm run smoke:capture
npm run smoke:clipboard
npm run smoke:windows
npm run smoke:match
npm run smoke:match-tap
npm run smoke:a11y
npm run smoke:desktop
npm run smoke:android
```

`smoke` 会控制本机桌面，请在运行前确认当前环境可以接受窗口聚焦、鼠标移动和键盘输入。

更多说明见 [scripts/README.md](../scripts/README.md)。

## 微信集成脚本

微信脚本位于 `scripts/integration/`，用于真实应用集成验证：

| npm 命令 | 脚本 | 说明 |
|----------|------|------|
| `integration:wechat:match` | `wechat-match.ts` | 匹配左侧会话并点击 |
| `integration:wechat:send` | `wechat-send.ts` | 匹配、输入并发送消息 |
| `integration:wechat:dump` | `06-uia-dump-wechat.ts` | dump UIA 树，不发送消息 |

示例：

```powershell
$env:WECHAT_MESSAGE="你好"
npm run integration:wechat:send
```

`integration:wechat:send` 会向真实微信发送消息，运行前必须确认模板、联系人和消息内容。

## Benchmark

NCC benchmark 依赖 Smoke 截图生成的 fixture：

```bash
npm run smoke:capture
npm run benchmark:ncc
npm run benchmark:ncc:rust
```

`benchmark:ncc:rust` 只测匹配路径；`benchmark:ncc` 包含截图开销。

## 选择建议

- 学核心 API：从 Paint 示例开始。
- 查模板匹配稳定性：运行 `smoke:match` 和 `smoke:match-tap`。
- 查无障碍树：运行 `example:paint:ui-tree` 或 `integration:wechat:dump`。
- 查 Android ADB：运行 `smoke:android` 前先确认设备授权。
