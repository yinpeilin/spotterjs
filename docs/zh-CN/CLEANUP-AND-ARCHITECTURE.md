# spotterjs 架构清理与修改总纲

> 版本：OpenCV 删除后 v1  
> 范围：Rust crate、TypeScript 包、文档、lockfile  
> 目标：单路径 NCC 匹配、文档与代码一致、修已知 bug、API 能力对齐

## 1. 背景

OpenCV 插件与 native 包已删除，NCC v2 承担全部模板匹配（scale、多线程、Buffer/path）。匹配链路统一为：

```
screen.findTemplate → @spotterjs/node → spotterjs-core::matcher → spotterjs-plugin-match-ncc
```

## 2. 目标架构

```
@spotterjs/core
  └── @spotterjs/node (spotterjs-node)
        └── spotterjs-core
              ├── spotterjs-base (types, errors, napi convert)
              └── spotterjs-plugin-match-ncc (唯一 matcher)
```

## 3. 修改总览

| 优先级 | 类别 | 项 | 状态 |
|--------|------|-----|------|
| P0 | Bug | `find_all_templates` region | 已修复 |
| P0 | 工程 | 刷新 lockfile | 已修复 |
| P1 | 文档 | README / MATCHING / CONTRIBUTING / package README | 已更新 |
| P2 | API | Buffer needle 扩到 `windows.findTemplate` / `windows.tapTemplate` | 已添加 |
| P2 | API | 移除 useMatchPlugin，screen 直调 native | 已简化 |
| P3 | Rust | PlatformWindow::client_origin | 已补全 |

## 4. API 能力矩阵

| API | path | Buffer | scale | region |
|-----|------|--------|------------|--------------|
| `screen.findTemplate` / `findAll` / `waitFor` | 是 | 是 | 是 | 是 |
| `screen.tapTemplate` | 是 | 是 | 是 | 是 |
| `windows.findTemplate` / `tapTemplate` | 是 | 是 | 是 | 是 |
| `windows.findAllTemplates` | 是 | 是 | 是 | 是 |

## 5. Search region 行为

带 `region` 时，core 会先裁剪 haystack，再将 native search region 重置为 `(0,0,w,h)` 后交给 NCC。`find` 与 `findAll` 使用相同逻辑，结果坐标均翻译回屏幕空间。

## 6. 验收

```bash
cargo test --workspace
npm test
npm run verify-pack
```

## 7. 相关文档

- [MATCHING.md](./MATCHING.md) — 模板匹配用法
- [README.md](../README.md) — 项目概览
