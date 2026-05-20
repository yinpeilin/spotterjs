# 微信模板图

微信自动化**只使用模板匹配**（NCC），不用 OCR 点文字。

## 准备联系人行

1. 打开微信，左侧能看到目标会话（如 **文件传输助手**）。
2. 用系统截图或 `Win+Shift+S`，裁 **一整行会话**（建议含左侧头像 + 昵称），保存为：

   `file-transfer-assistant.png`

3. 尺寸建议：宽 ≤512px、高 48–72px（与当前主题一致；换深色模式需重做）。

4. 运行：

   ```bash
   npm run integration:wechat:send
   ```

可选环境变量：`WECHAT_CONTACT_TEMPLATE`、`WECHAT_SEND_TEMPLATE`（发送按钮小图）、`WECHAT_MATCH_CONFIDENCE`（默认 0.72）。

## 为何不用 Tesseract OCR 点击？

Tesseract 对 UI 截图常把中文拆成单字、框错位，**能读出字但坐标不能用来点击**。若以后要做「按文字点击」，更适合：

| 方案 | 中文 UI | 文字框 | 备注 |
|------|---------|--------|------|
| **PaddleOCR** | 很好 | 有 | 开源，本地推理，推荐后续接入 |
| EasyOCR | 较好 | 有 | 安装简单，速度较慢 |
| Windows.Media.Ocr | 一般 | 有 | 系统自带，需 Win10+ 语言包 |
| Tesseract.js | 差 | 不可靠 | 当前已停用 |

Spotter 发微信流程：**模板图定位 + 剪贴板输入** 即可稳定完成。
