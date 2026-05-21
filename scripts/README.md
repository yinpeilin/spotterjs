# Spotter Smoke 与 Integration 脚本

## 构建

```bash
cargo build -p spotter-node
cd crates/spotter-node && npm install && npm run build
cd ../..
npm install
npm run build --workspace=@spotter/base
npm run build --workspace=@spotter/core
```

## Smoke

```bash
npm run smoke
npm run smoke:ncc:synthetic   # 合成图 NCC 回归（不依赖微信）
npm run smoke:match-tap       # 窗口匹配→鼠标对齐（含双屏，已纳入 smoke）
```

## 微信

共享逻辑与坐标系：`scripts/integration/lib/wechat-contact.ts`（窗口外框 = 截图像素原点）

| npm 命令 | 脚本 | 说明 |
|----------|------|------|
| `integration:wechat:match` | `wechat-match.ts` | 匹配左侧会话并点击 |
| `integration:wechat:send` | `wechat-send.ts` | 匹配 → 输入 → 发送 |
| `integration:wechat:dump` | `06-uia-dump-wechat.ts` | UIA 树调试，不发消息 |

模板与变量说明：`assets/wechat/templates/README.md`

```powershell
$env:WECHAT_MESSAGE="你好"
npm run integration:wechat:send
```

## 安全

- `integration:wechat:send` 会向真实微信发送消息，请先确认模板与联系人。
