# Spotter 发布手册（维护者）

源码托管：[Gitee ypl0lpy/spotter](https://gitee.com/ypl0lpy/spotter)  
npm 包：`@spotter/*`、`@spotter-rs/*`（公开 registry，按需发布）。

> 首版 npm 发布、CI 密钥由维护者在需要时自行配置；仓库已具备 monorepo 结构与脚本。

## Git 远程

```bash
git remote add origin git@gitee.com:ypl0lpy/spotter.git
git push -u origin master
```

HTTPS 克隆：`git clone https://gitee.com/ypl0lpy/spotter.git`

## 日常开发

```bash
npm ci
npm run build:ts
npm test
npm run sync-license   # 发布前同步 LICENSE 到各包
```

## Changesets 发版（npm，可选）

1. `npm run changeset`
2. `npm run version-packages`
3. 打 tag 后：`npm run release`（需 `NPM_TOKEN` 与原生 `napi prepublish`）

## 许可证

商用授权：`ypl123698745@qq.com` 或 [Issues](https://gitee.com/ypl0lpy/spotter/issues)
