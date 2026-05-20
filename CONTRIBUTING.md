# Contributing

## Setup

```bash
git clone https://gitee.com/ypl0lpy/spotter.git
cd spotter
npm ci
cargo build -p spotter-base -p spotter-core -p spotter-plugin-match-ncc
cd crates/spotter-node && npm install && npm run build
cd ../..
npm run build:ts
```

## Tests

```bash
npm test
```

Desktop smoke scripts are optional — see [scripts/README.md](scripts/README.md).

## Changesets

User-facing changes need a changeset: `npm run changeset`.

## License

By contributing, you agree that your contributions are licensed under [LICENSE](LICENSE) (Spotter License 1.0). Commercial use of the project by third parties requires separate authorization from the copyright holder.
