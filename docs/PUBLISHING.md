# spotterjs 发布手册（维护者）

源码托管：[Gitee ypl0lpy/spotterjs](https://gitee.com/ypl0lpy/spotterjs)  
npm 包：`@spotterjs/*`（公开 registry，按需发布）。

> 首版 npm 发布、CI 密钥由维护者在需要时自行配置；仓库已具备 monorepo 结构与脚本。

## Git 远程

```bash
git remote add origin git@gitee.com:ypl0lpy/spotterjs.git
git push -u origin master
```

HTTPS 克隆：`git clone https://gitee.com/ypl0lpy/spotterjs.git`

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
3. 打 tag 后：`npm run release`（需 `NPM_TOKEN`）

## Native platform packages

`@spotterjs/node` is the JS loader package. Platform binaries are published as optional packages:

- `@spotterjs/node-win32-x64-msvc`
- `@spotterjs/node-linux-x64-gnu`

Publish platform packages before `@spotterjs/node`:

```bash
# Windows x64 runner
npm run build -w @spotterjs/node
node scripts/prepare-native-package.mjs win32-x64-msvc
npm publish ./crates/spotterjs-node/win32-x64-msvc

# Linux x64 glibc runner
npm run build:linux -w @spotterjs/node
node scripts/prepare-native-package.mjs linux-x64-gnu
npm publish ./crates/spotterjs-node/linux-x64-gnu

# After platform packages are published
npm publish -w @spotterjs/node
```

## 许可证

商用授权：`ypl123698745@qq.com` 或 [Issues](https://gitee.com/ypl0lpy/spotterjs/issues)
