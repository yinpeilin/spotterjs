# NCC synthetic fixtures

Programmatic test images for template matching (no WeChat / live UI).

## Generate

```bash
npm run smoke:ncc:synthetic
```

Each subdirectory has `haystack.png` and `needle.png`. Green-box overlays: `test-output/ncc-synthetic/`.

## Rust regression

```bash
cargo test -p spotterjs-plugin-match-ncc --test ncc_synthetic_scenarios
```

Scenario builders live in `crates/spotterjs-plugin-match-ncc/tests/common/fixtures.rs`.

## Scenarios (16)

| Name | What it exercises |
|------|-------------------|
| `solid_patch_64` | Flat color block |
| `gradient_icon_400x300` | Gradient + checker icon (slide regression) |
| `tiny_icon_8x8` | Small template on gradient |
| `stripe_pattern` | Horizontal stripe texture |
| `wide_toolbar_chip` | Wide shallow template (56×14) |
| `tall_sidebar_chip` | Tall narrow template (14×40) |
| `noise_background` | Random noise field |
| `low_contrast_patch` | Barely brighter than background |
| `search_region_top_left` | ROI excludes duplicate patch |
| `medium_800x600` | No pyramid (<1920×1080) |
| `large_pyramid_center` | Pyramid coarse-to-fine, center |
| `large_pyramid_topleft` | Pyramid, top-left target |
| `large_pyramid_bottomright` | Pyramid, bottom-right target |
| `decoy_different_pattern` | Same-size distractor |
| `multiscale_1p5x` | Hay patch larger than needle |
| `multiscale_0p8x` | Hay patch smaller than needle |

Additional Rust-only checks: `find_all` (2 and 3 duplicates), fast vs serial path, impossible confidence.
