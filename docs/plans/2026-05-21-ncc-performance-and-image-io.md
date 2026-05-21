# NCC 性能优化 + Rust 图像 I/O 实现计划

> **面向 AI 代理的工作者：** 必需子技能：subagent-driven-development（推荐）或 executing-plans。步骤使用 `- [ ]` 跟踪进度。

**目标：** 将 NCC 匹配性能提升一个数量级（multi-scale 从 ~21s 降到 ~1s 以内），并明确/统一「图像读取只在 Rust 层、跨平台」的架构边界。

**架构：** 生产链路保持 `screen → node → core → plugin`；图像 decode/encode 收敛到 `spotter-core::image`（基于 `image` crate，纯 Rust、跨平台）；NCC 算法分三阶段优化（并行修复 → 预计算+积分图 → 滑动窗口）。

**技术栈：** Rust (`image` 0.25, `rayon`), `@spotter-rs/node` (napi), `@spotter/core`

**基准（1536×960 hay, 32×32 needle, 纯匹配）：**

| 场景 | 当前 | 目标 |
|------|------|------|
| 单尺度 | ~334 ms | < 50 ms |
| 多尺度 9 档 | ~21,330 ms | < 1,000 ms |

---

## 0. 现状核对：图像 I/O 谁在读？

### 生产路径（已正确 — Rust 解码）

```
screen.find(path)       → findTemplate(path)        → load_rgba_from_path()   [Rust image::open]
screen.find(Buffer)     → findTemplateWithNeedle()  → load_rgba_from_bytes()  [Rust image::load_from_memory]
screen.capture()        → captureScreen()             → PlatformCapture           [Win GDI / Linux X11]
findTemplateBuffers()   → capture_from_js()           → 期望已是 RGBA8，不解码 PNG
```

`load_rgba_from_*` 实现在 `crates/spotter-plugin-match-ncc/src/lib.rs`，由 `spotter-core/src/matcher.rs` 调用。

### TypeScript 仍在用 pngjs 的地方（非匹配热路径）

| 位置 | 用途 | 是否问题 |
|------|------|----------|
| `packages/core/src/capture.ts` | RGBA → PNG 编码（MCP base64） | 可接受；后续可迁 Rust |
| `scripts/lib/png.ts` | smoke 测试写 fixture | 仅 dev 脚本 |
| `scripts/integration/wechat-send.ts` | 读模板尺寸做 warn | 应改用 native API |
| benchmark 误用（若用 pngjs 加载 hay/needle） | 绕过 Rust decode | 需修正 |

**结论：** 模板匹配的 **decode 已在 Rust**；问题是 (1) 模块归属在 plugin 而非 core，边界不清；(2) `image` crate features 未显式锁定；(3) dev 工具/MCP 编码仍依赖 TS pngjs；(4) benchmark 应只测 Rust 路径。

---

## 阶段 A：Rust 图像 I/O 统一（1–2 天）

### 任务 A1：新建 `spotter-core/src/image.rs`

**文件：**
- 创建：`crates/spotter-core/src/image.rs`
- 修改：`crates/spotter-core/src/lib.rs`（mod + re-export）
- 修改：`crates/spotter-core/src/matcher.rs`（改 import）
- 修改：`crates/spotter-plugin-match-ncc/src/lib.rs`（删除 load 函数，或 re-export core）

- [ ] **步骤 1：迁移 decode 函数到 core**

```rust
// crates/spotter-core/src/image.rs
use spotter_base::{Result, RgbaImage, SpotterError};
use std::path::Path;

pub fn load_rgba_from_path(path: &Path) -> Result<RgbaImage> {
    let img = image::open(path).map_err(|e| SpotterError::Image(e.to_string()))?;
    rgba_from_dynamic(img)
}

pub fn load_rgba_from_bytes(bytes: &[u8]) -> Result<RgbaImage> {
    let img = image::load_from_memory(bytes).map_err(|e| SpotterError::Image(e.to_string()))?;
    rgba_from_dynamic(img)
}

pub fn image_size_from_path(path: &Path) -> Result<(u32, u32)> {
    let img = image::open(path).map_err(|e| SpotterError::Image(e.to_string()))?;
    Ok((img.width(), img.height()))
}

fn rgba_from_dynamic(img: image::DynamicImage) -> Result<RgbaImage> {
    let rgba = img.to_rgba8();
    Ok(RgbaImage { width: rgba.width(), height: rgba.height(), data: rgba.into_raw() })
}
```

- [ ] **步骤 2：锁定跨平台格式 features**

修改根 `Cargo.toml`：

```toml
image = { version = "0.25", default-features = false, features = ["png", "jpeg", "webp"] }
```

- [ ] **步骤 3：添加 Rust 测试**

```rust
#[test]
fn load_png_bytes_roundtrip() { /* 同现有 plugin 测试 */ }

#[test]
fn load_jpeg_from_bytes() { /* fixture or generated */ }
```

运行：`cargo test -p spotter-core image::`
预期：PASS

- [ ] **步骤 4：Commit** — `refactor(core): centralize cross-platform image decode`

---

### 任务 A2：暴露 native 图像工具 API

**文件：**
- 修改：`crates/spotter-node/src/lib.rs`
- 修改：`packages/core/src/native.ts`（类型）
- 修改：`packages/core/src/index.ts`（可选 re-export）

- [ ] **步骤 1：添加 napi 函数**

```rust
#[napi(js_name = "loadImageFromPath")]
pub fn load_image_from_path(path: String) -> Result<JsCaptureImage> {
    let img = spotter_core::load_rgba_from_path(Path::new(&path))?;
    capture_to_js(&img)
}

#[napi(js_name = "getImageSize")]
pub fn get_image_size(path: String) -> Result<JsSize> {
    let (w, h) = spotter_core::image_size_from_path(Path::new(&path))?;
    Ok(JsSize { width: w, height: h })
}
```

- [ ] **步骤 2：wechat 脚本改用 `getImageSize`**

修改 `scripts/integration/wechat-send.ts`：删除 `pngjs` import 与 `readTemplateSize`，改用 native。

- [ ] **步骤 3：Commit** — `feat(node): expose loadImageFromPath and getImageSize`

---

### 任务 A3：（可选）Rust PNG 编码替代 capture.ts

**优先级 P2** — MCP 需要 base64 PNG 时走 native。

- [ ] 在 `spotter-core/src/image.rs` 添加 `encode_rgba_to_png`
- [ ] napi 暴露 `encodeCapturePng`
- [ ] `packages/core/src/capture.ts` 改为 thin wrapper 调 native
- [ ] 将 `pngjs` 从 `packages/core` dependencies 移到 devDependencies（仅 scripts 保留）

---

## 阶段 B：NCC 快速修复（半天）

### 任务 B1：多尺度启用并行

**文件：**
- 修改：`crates/spotter-plugin-match-ncc/src/ncc.rs`
- 修改：`crates/spotter-plugin-match-ncc/src/multiscale.rs`

- [ ] **步骤 1：抽取统一入口**

```rust
// ncc.rs
pub fn find_best(
    haystack: &RgbaImage,
    hay: &[f32],
    needle: &PreparedNeedle,
    opts: &MatchOptions,
    blocked: Option<&[bool]>,
) -> Result<(Region, f64)> {
    if blocked.is_some() {
        return find_best_serial(haystack, hay, needle, opts, blocked);
    }
    #[cfg(feature = "parallel")]
    {
        return super::parallel::find_best_parallel(haystack, hay, needle, opts);
    }
    #[cfg(not(feature = "parallel"))]
    find_best_serial(haystack, hay, needle, opts, None)
}
```

- [ ] **步骤 2：multiscale 改调 `find_best`**

```rust
// multiscale.rs — 替换 find_best_serial 调用
find_best(haystack, &hay_gray, &prepared, &local_opts, None)
// 去掉 needle_gray.clone()，prepare_needle 直接 move needle_gray
```

- [ ] **步骤 3：运行测试**

```bash
cargo test -p spotter-plugin-match-ncc
```

- [ ] **步骤 4：基准验证**

```bash
npm run benchmark:ncc
```

预期：multi-scale 从 ~21s 降到 ~2.5–3.5s（仍含截屏）

- [ ] **步骤 5：Commit** — `fix(ncc): use parallel scan in multi-scale find`

---

### 任务 B2：消除多余分配

- [ ] `find_single` 中 `needle_gray.to_vec()` 改为接受 `Vec<f32>` 或 `&[f32]` + 内部只 copy 一次
- [ ] `PreparedNeedle::from_gray(gray: Vec<f32>, ...)` 预计算 needle 统计量（见阶段 C）

---

## 阶段 C：NCC 算法优化（2–3 天）

### 任务 C1：PreparedNeedle 预计算

**文件：** `crates/spotter-plugin-match-ncc/src/ncc.rs`

- [ ] 扩展 `PreparedNeedle`：

```rust
pub struct PreparedNeedle {
    pub gray: Vec<f32>,      // 原始灰度
    pub centered: Vec<f32>,  // gray[i] - mean
    pub norm: f64,           // sqrt(sum centered^2)
    pub nw: u32,
    pub nh: u32,
}
```

- [ ] 重写 `ncc_at` 为：

```rust
// NCC = dot(hay_window, centered) / (norm_h * norm)
// norm_h = sqrt(sum_sq_h - n * mean_h^2)
```

- [ ] 保持与现有测试 `find_locates_exact_patch` 等结果一致（score 误差 < 1e-6）

---

### 任务 C2：Haystack 积分图

**文件：** 新建 `crates/spotter-plugin-match-ncc/src/integral.rs`

- [ ] 实现 `IntegralImage`：`sum` 与 `sum_sq` 两张表
- [ ] O(1) 查询窗口 `sum_h`、`sum_sq_h` → `mean_h`、`norm_h`
- [ ] 在 `find_best_serial` / `find_best_parallel` 搜索前构建一次

---

### 任务 C3：滑动列点积

- [ ] 首行首列：完整计算 `dot(h, centered)`
- [ ] 水平步进：减左列、加右列 → O(nh) / step
- [ ] 换行：减顶行、加底行 → O(nw) / step
- [ ] 并行策略：仍按行 `par_iter`，行内滑动

**验收：**

```bash
# 纯匹配基准（Rust path，无截屏）
cargo run -p spotter-plugin-match-ncc --example bench_ncc -- test-output/capture.png test-output/needle.png
```

目标：单尺度 < 50ms，multi < 1s

---

## 阶段 D：多尺度并行（1 天）

### 任务 D1：scale 维度并行

**文件：** `crates/spotter-plugin-match-ncc/src/multiscale.rs`

- [ ] 收集 scale 列表 `Vec<f64>`
- [ ] `scales.par_iter().filter_map(...)` 各 scale 独立 resize + find_best
- [ ] reduce 取最高分 region
- [ ] `find_all` collect 模式保持串行 peak suppression（文档已说明）

---

### 任务 D2：（可选）粗到细金字塔

- [ ] 0.5× haystack 粗搜 top-3 候选
- [ ] 全分辨率 ROI ±(2×needle) 精搜
- [ ] 仅 `multiScale: false` 单尺度路径启用；multi-scale 各档已含 resize

---

## 阶段 E：Benchmark 与文档

### 任务 E1：Rust 基准 CLI

**文件：** 新建 `crates/spotter-plugin-match-ncc/examples/bench_ncc.rs`

- [ ] 读 path → `load_rgba_from_path`（core）
- [ ] 计时 single / multi，打印 ms
- [ ] `npm run benchmark:ncc` 改为调用此 example（或保留 TS 版但注明含 capture 开销）

### 任务 E2：更新文档

- [ ] `docs/MATCHING.md` — 图像 I/O 架构图、性能目标、Rust-only decode 说明
- [ ] `docs/CLEANUP-AND-ARCHITECTURE.md` — 补充 image 模块归属

---

## 执行顺序（推荐）

```
A1 → A2 → B1 → E1（验证 B1 收益）
  → C1 → C2 → C3 → D1 → E2
  → A3（可选，MCP 编码迁 Rust）
```

## 风险与约束

| 项 | 说明 |
|----|------|
| `findTemplateBuffers` | 仍要求 RGBA8；不解码 PNG。文档写清，或后续支持 encoded buffer |
| `find_all` 并行 | blocked mask 与 peak suppression 需专门设计，本计划不强制 |
| 数值精度 | 滑动/积分实现需与朴素 `ncc_at` 对齐测试 |
| Linux CI | 确保 `image` features 不引入平台特有 native 依赖 |

## 每阶段验收命令

```bash
cargo test --workspace
cargo clippy --workspace -- -D warnings
npm test
npm run benchmark:ncc
npm run verify-pack
```
