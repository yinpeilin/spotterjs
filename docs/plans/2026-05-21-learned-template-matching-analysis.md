# 学习式模板匹配方案分析

> **日期：** 2026-05-21（需求更新：同日）  
> **背景：** 当前 NCC 在微信等真实 UI 场景下匹配率/稳定性不足；需求是在大图中定位小图位置。  
> **产品约束（更新）：** **不考虑旋转**（UI 始终正向）；但必须 **外观鲁棒**——模板内局部文字/预览变化、整行或控件 **背景色/主题切换** 后仍能定位。  
> **结论先行：** 这是「**结构/局部稳定特征匹配**」，不是纯像素拷贝。NCC 在此类需求下先天不足；最务实路线是 **Masked 局部匹配 + 学习式 Siamese matcher（训练时强化颜色/内容扰动）**，NCC 仅作 fallback。

---

## 0. 需求约束（PRD 摘要）

| 维度 | 要求 | 优先级 |
|------|------|--------|
| **旋转** | 不需要，按 0° 验收 |  out of scope |
| **等比缩放** | DPI / 窗口缩放，约 0.75×–1.25× | P0 |
| **背景色 / 主题** | 浅/深主题、hover 高亮、选中行底色变化后仍能命中 | **P0** |
| **模板内内容变化** | 预览文字（`[图片]`、`昨天`）、未读数、次要文案变化后仍能命中 | **P0** |
| **布局结构** | 头像 + 主标题 + 行高等 **稳定几何** 应对齐 | P0 |
| **误点率** | 自动化场景，FP 必须极低 | P0 |
| **延迟** | P95 < 300ms（1536×960 量级，CPU） | P1 |

**典型验收用例（微信联系人行）：**

- 模板截于浅色主题 + 预览「你好」→ 运行时深色主题 + 预览「[图片]」→ **仍命中同一行**
- 模板截于未选中行 → 运行时该行被选中（背景变灰/变绿）→ **仍命中**
- 模板只含左侧头像 + 昵称区，不含右侧预览 → **预览怎么变都不影响**

> 本质：用户要找的是「**这条 UI 结构/这条控件**」，不是「**和 PNG 逐像素一样的那块 bitmap**」。

---

## 1. 我们要解决的是什么问题

### 1.1 形式化定义

| 输入 | 输出 |
|------|------|
| **Haystack** \(H\)：屏幕/窗口截图，典型 800×600 ~ 3840×2160 | 一个或多个 **Region** `{ left, top, width, height }` |
| **Needle** \(N\)：用户提供的模板图，典型 32×32 ~ 512×512 | 置信度 score |
| 可选 **searchRegion** | 屏幕坐标（spotterjs 现有约定） |
| 可选 **mask**（规划） | 标记 needle 中哪些像素参与匹配（稳定区=1，动态区=0） |

任务类型：**appearance-robust template localization**（外观鲁棒的模板定位），不是经典「像素级模板匹配」。

### 1.2 spotterjs 当前约束

```
screen.find / findInWindow
  → spotterjs-core::matcher
  → spotterjs-plugin-match-ncc   （唯一 MatchPlugin 实现）
```

- 算法：`TM_CCOEFF_NORMED` 等价 NCC，灰度 + 积分图 + SIMD
- 已支持：`multiScale`、`searchRegion`、金字塔粗搜
- **不支持**：mask、局部/content-aware 相似度、主题不变特征、学习式匹配
- 模板上限：512×512
- 扩展点：`spotterjs-base::MatchPlugin` trait 可挂新 backend

### 1.3 典型失败模式（与 PRD 的对应）

| 原因 | NCC 表现 | PRD 是否必须过 |
|------|----------|----------------|
| 深色/浅色主题、选中行背景色 | 灰度/颜色分布变 → 分数低 | **必须** |
| 预览/状态文字变化 | 模板含动态区 → 真阳性分数低 | **必须** |
| DPI / 窗口缩放 | 需 multiScale | 必须 |
| 模板二次截图、插值模糊 | 分数整体偏低 | 应该 |
| 多行结构相似 | 低 threshold 误匹配 | 必须（低 FP） |
| 旋转 | 不支持 | **不要求** |

NCC 假设 needle ≈ hay 的 **平移 + 等比缩放 + 亮度线性** 拷贝；PRD 要求 **内容可变、颜色可变**，二者直接冲突——这不是调 `confidence` 能根治的。

---

## 2. 「大图找小图」成熟吗？

**成熟，且你们的场景比「带旋转的通用匹配」更窄、更好做**——不需要 rotation-invariant 模型，可以把算力全部用在 **颜色不变性 + 局部结构 + 动态区忽略** 上。

```
像素相关 (NCC)           ← 对 PRD 最弱
    ↓
Masked NCC / 边缘模板     ← 经典 CV 快赢，需 mask 规范
    ↓
学习式 Siamese TM        ← 训练时做「换背景、换局部文字」增强，最贴 PRD
    ↓
按类检测 (YOLO)          ← 固定控件库，非通用 needle API
```

选型关键问题（更新后）：

1. 模板里 **哪些区域是稳定的**（头像、图标、主标题）？→ 决定 mask 与学习重点
2. 尺度范围？→ multiScale / 网络 pyramid
3. ~~旋转范围？~~ → **固定 0°，不验收**
4. 延迟与是否接受小模型依赖？

spotterjs 场景仍是：**用户给 needle PNG，实时截图里找位置**（one-shot TM），但相似度定义要从「像素相关」升级为「**稳定区域结构相似**」。

---

## 3. 方案对比（按 PRD 重排）

### 3.1 总览

| 方案 | 缩放 | 背景色/主题 | 模板内文字变化 | 需训练 | 典型延迟* | 推荐度 |
|------|------|-------------|----------------|--------|-----------|--------|
| **NCC（现状）** | multiScale | 弱 | 弱 | 否 | 30~200ms | fallback only |
| **Masked NCC** | multiScale | 中 | **强**（mask 掉动态区） | 否 | 40~220ms | **Phase 1 必做** |
| **边缘 / 梯度模板** | multiScale | **较强** | 中（文字边缘变） | 否 | 80~300ms | Phase 1 可选 |
| **Siamese 学习式 TM** | 内置 | **强** | **强**（靠训练增强） | 预训练+微调 | 80~400ms | **Phase 2 核心** |
| **ORB/AKAZE 特征** | 金字塔 | 中 | 中 | 否 | 50~300ms | 次要（重复纹理多时不稳） |
| **按类 YOLO** | 内置 | 强 | 强 | 每类标注 | 30~150ms | 控件库场景 |
| **UIA 无障碍** | — | 强 | 强 | 否 | 10~100ms | 微信等可并行 |

\* 1536×960 hay，Release，CPU。

**旋转列已移除**——不在产品范围内，相关方案（旋转 NCC、RANSAC 旋转估计）不做优先项。

### 3.2 为什么「换背景色 + 换内容还要认出」必须换思路

| 机制 | 对背景色 | 对局部内容变化 |
|------|----------|----------------|
| 灰度 NCC | 部分归一化，主题大变仍掉分 | 动态区像素参与相关 → 掉分 |
| **Mask：只比 stable 区域** | 稳定区小，背景色影响范围可控 | **动态区不参与 → 直接解决** |
| 边缘/结构匹配 | 边缘对整体亮度较稳 | 文字边缘会变，需 mask 掉预览区 |
| Siamese + 增强 | 训练时 **随机 recolor 背景** | 训练时 **随机替换局部 patch 文字/噪声** |
| 纯 OCR | 不适用 | 只能找「字」，不能找「行结构」 |

**PRD 的核心工程产物：** 除了 `needle.png`，还需要 **`needle.mask.png`（或 alpha 通道约定）**——告诉 matcher「哪些像素代表这条控件，哪些可以忽略」。

推荐模板规范（微信联系人行）：

```
┌──────────────────────────────────────┐
│ [avatar]  文件传输助手    │ 动态预览  │
│  ███████   ████████       │ ░░░░░░░  │
│  参与匹配   参与匹配       │  mask=0  │
└──────────────────────────────────────┘
```

### 3.3 经典 CV：Phase 1 快赢

#### A. Masked NCC（优先实现）

- 仅对 mask=1 的像素做归一化互相关（或分块加权）
- 优点：实现量小于神经网络；与现有 `MatchPlugin` 兼容；**直接解决「预览文字变了」**
- 缺点：主题变化时，**未 mask 的稳定区**（昵称文字）仍会受 anti-alias/字体渲染影响
- **结论：** 无训练成本最高 ROI；应和模板文档一起推

#### B. 边缘 / 梯度模板（Canny/Sobel + NCC 或 Chamfer）

- 对 **结构**（头像轮廓、分隔线）更稳，对 flat 背景色不敏感
- 缺点：细中文笔画边缘随 subpixel 变；仍需 mask
- **结论：** 作 Masked NCC 的补充 backend，不必单独作为主路径

#### C. 多尺度 NCC（已有）

- 保留为 fallback；**不能单独满足 PRD**

#### ~~D. 旋转 NCC~~ — 不纳入范围

### 3.4 学习式方案：小模型仍值得做，但训练目标要改

#### 形态 A：通用 Siamese matcher（**仍推荐**）

与「任意 needle PNG」API 一致，但 **synthetic 增强必须对齐 PRD**：

| 增强类型 | 目的 |
|----------|------|
| 随机 background color / theme pair | 浅色↔深色、选中/hover 色 |
| 随机 paste 局部 noise / 假文字块 | 模拟预览区、未读数变化 |
| scale 0.75–1.25 | DPI |
| blur / JPEG / 子像素偏移 | 截图真实性 |
| ~~rotate~~ | **不做** |

网络侧可选设计：

- **Dual encoder + correlation**（经典 Siamese TM）
- 输入 **RGB + mask channel**（4 通道），loss 只在 mask 区域计算
- 可选 **颜色 jitter 只作用于 hay、不作用于 needle stable 区** 的 hard negative

**优点：** 一个模型覆盖所有模板；背景/内容扰动可系统性覆盖；比手工 mask+NCC 上限更高。  
**缺点：** 要维护 ONNX；比 NCC 慢；仍依赖 mask 或训练集覆盖 OOD。

#### 形态 B：按类检测器 — 不变

适合内置控件库，不适合通用 `screen.find(path)`。

#### 形态 C：CLIP 类 — 仍不优先

小目标定位精度不如专用 TM；中文 UI 细粒度不够。

### 3.5 「训练一个小模型」在 PRD 下的含义

| 项目 | 说明 |
|------|------|
| **训练什么** | 一个 **通用 matcher**，学的是 stable 结构相似度，不是像素相等 |
| **数据** | synthetic：同 layout、换背景色、换局部文字；real：微信等 200+ 框 |
| **标注** | `(hay, needle, bbox, mask)`；hard negative：相似列表行 |
| **验收** | **主题切换集**、**内容变化集** 分开报 Recall |
| **模型** | <10M 参数，ONNX INT8 <5MB |
| **推理** | `spotterjs-plugin-match-learned` + ort |

---

## 4. 缩放与外观变化：各方案怎么处理

| 方法 | 缩放 0.75–1.25× | 背景色/主题 | 模板内动态文字 |
|------|------------------|-------------|----------------|
| NCC + multiScale | 离散 scale 网格 | 弱 | 弱 |
| **Masked NCC + multiScale** | 同左 | 中 | **强（mask 正确时）** |
| 边缘模板 + mask | 多尺度 | 较强 | 中 |
| Siamese TM | pyramid / corr | **强（增强训练）** | **强（mask + 增强）** |
| UIA | — | 强 | 强（按 accessibility name） |

**需求分级（更新）：**

1. **P0：** 背景色/主题 + 局部内容变化 + mask 规范
2. **P0：** 等比缩放 0.75×–1.25×
3. ~~P1：旋转 ±15°~~ — **取消**

---

## 5. 数据与训练成本估算

### 5.1 Synthetic（2–5 天，必须包含 PRD 扰动）

- 随机 UI 背景色（HSV 大范围）+ paste 模板块
- **同 bbox 内随机替换右侧 30–50% 区域为噪声/假文字**（模拟预览变化）
- scale 0.75–1.3；blur；JPEG；**不做 rotate**
- 50k–200k 样本
- 验证：**held-out 主题色 + held-out 预览文案** 各一套

### 5.2 Synthetic + 真实 UI（2–4 周）

| 阶段 | 工作 |
|------|------|
| 采集 | 同一 needle，截 **浅/深主题、选中/未选中、不同预览** 的 hay |
| 标注 | bbox + **stable 区 mask** |
| 验证集 | 按「主题」「预览文案」分层，禁止泄漏 |
| 指标 | 分集 Recall；中心误差 <8px；FP <2% |

### 5.3 人力粗算

- Mask 规范 + Masked NCC：3–5 天
- 学习 pipeline + 分集 benchmark：2 周
- ONNX 集成：1 周

---

## 6. 推荐技术路线（分阶段，已按 PRD 调整）

### Phase 0：Benchmark（1–3 天，必做）

```
assets/benchmark/wechat/
  needle.png
  needle.mask.png          # 新增：稳定区
  captures/
    light-theme-*.png
    dark-theme-*.png
    selected-row-*.png
    preview-text-*.png     # 不同预览文案
  manifest.json            # gt bbox + tags: theme, preview_variant
```

**分集报告（必做）：**

| 子集 | 指标 |
|------|------|
| `theme` | Recall @ FP<2% |
| `preview_change` | Recall @ FP<2% |
| `scale` | Recall |
| 全体 | P50/P95 延迟 |

NCC baseline 会明确暴露：**preview_change / theme 子集最差**——用来证明换算法的必要性。

### Phase 1：无训练快赢（3–5 天，**提升优先级**）

1. **`needle.mask.png` 规范** + 文档更新（模板 README）
2. **`spotterjs-plugin-match-ncc`：Masked NCC**（或 weighted NCC）
3. 微信脚本默认 `multiScale: true` + `searchRegion` + 文档要求只 mask 稳定区
4. （可选）边缘模板 backend

预期：**preview 变化类 case 大幅改善**；主题切换仍有 gap → Phase 2。

### Phase 2：学习式 matcher MVP（3–4 周）

- 训练目标对齐 PRD 增强（换背景、换局部内容）
- 输入支持 mask channel
- API：

```typescript
await screen.find("./row.png", {
  matcher: "learned",
  mask: "./row.mask.png",   // 或 needle 内 alpha 约定
  confidence: 0.85,
  multiScale: true,
});
```

- ~~`maxRotationDeg`~~ 不暴露

### Phase 3：生产化

- INT8；learned 失败 → masked NCC → plain NCC 级联
- 失败截图按 tag（theme/preview）入库再训

---

## 7. 架构示意

```
  needle.png ──┐
  needle.mask ─┼──► Decode RGBA + mask
  hay capture ─┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
 Masked NCC  Edge+Mask   Learned Siamese
 (fallback)  (optional)  (primary)
    └────┬────┴──────────────┘
         ▼
    Region + score  →  screen.find / tap
```

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| 用户不提供 mask | 默认全 1（等同 NCC）；文档 + 工具生成 mask；learned 模型可弱监督 |
| 昵称文字也变化 | mask 只留头像+图标；或 UIA/OCR 辅助 |
| 相似行误匹配 | searchRegion；NMS；hard negative 训练 |
| 模型慢 | ROI；hay 缩放到 1280 宽；INT8 |
| 主题 OOD | benchmark 分集驱动迭代 |

---

## 9. 决策建议（更新）

| 问题 | 建议 |
|------|------|
| 还要不要 NCC？ | 要，作 **无 mask / 无模型** 的 fallback |
| 旋转？ | **不做** |
| PRD 核心矛盾？ | 像素相等 vs 结构相等 → **mask + 学习式相似度** |
| 第一版做什么？ | **Phase 1 Masked NCC** + benchmark 分集；再 **Siamese + 主题/内容增强** |
| 微信联系人行？ | 模板 = 头像+昵称；**mask 掉预览**；learned 用 theme/preview 分集验收 |
| 成功标准？ | `preview_change` Recall ≥95%；`theme` Recall ≥95%；FP<2%；P95<300ms |

---

## 10. 下一步行动

- [ ] **P0** benchmark 分集（theme / preview_change / scale）+ NCC baseline
- [ ] **P0** 定义 `needle.mask.png` 格式 + 微信模板示例
- [ ] **P1** Masked NCC 实现 + 微信脚本接入
- [ ] **P1** synthetic 生成器（换背景色 + 换局部内容，无 rotate）
- [ ] **P2** Siamese ONNX PoC，训练/验收对齐 PRD 分集
- [ ] **P2** `matcher: "learned"` + mask API

---

## 11. 参考资料

- Masked template matching / weighted NCC（经典 CV）
- Siamese TM + synthetic paste with appearance randomization
- UiPath CV、商业 RPA 的「Fuzzy / Flexible selector」——本质是结构+多特征，不是像素 NCC
- ONNX Runtime Rust：`ort` crate

---

## 附录 A：微信脚本

1. **立刻**：模板改为「头像+昵称」，提供 mask；`multiScale` + `searchRegion`
2. **Phase 1 后**：Masked NCC 应解决预览变化
3. **Phase 2 后**：`matcher: "learned"` 解决主题切换残余 case
4. **并行**：UIA `ListItem` 按 name 查找（零视觉依赖）

---

## 附录 B：术语

| 术语 | 含义 |
|------|------|
| Stable region | 模板中随运行环境不变的部分（avatar、固定图标） |
| Dynamic region | 预览、时间、未读数等变化部分 → mask=0 |
| Appearance robust | 背景色、局部内容变，位置仍可找 |
| Masked NCC | 仅在 mask 像素上计算归一化相关 |
