//! Shared synthetic haystack / needle builders for NCC integration tests.

use spotterjs_base::{MatchOptions, Region, RgbaImage};

pub const CONFIDENCE: f64 = 0.85;
pub const TOL: i32 = 2;

pub struct Scenario {
    pub name: &'static str,
    pub hay: RgbaImage,
    pub needle: RgbaImage,
    pub expected: (i32, i32),
    pub opts: MatchOptions,
    pub tol: i32,
}

pub fn solid(w: u32, h: u32, rgb: [u8; 3]) -> RgbaImage {
    let mut data = vec![0u8; (w * h * 4) as usize];
    for px in data.chunks_mut(4) {
        px.copy_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
    }
    RgbaImage {
        width: w,
        height: h,
        data,
    }
}

pub fn gradient_bg(w: u32, h: u32) -> RgbaImage {
    let mut data = vec![0u8; (w * h * 4) as usize];
    for y in 0..h {
        for x in 0..w {
            let i = ((y * w + x) * 4) as usize;
            data[i] = ((x * 255) / w.max(1)) as u8;
            data[i + 1] = ((y * 255) / h.max(1)) as u8;
            data[i + 2] = (((x + y) * 128) / (w + h).max(1)) as u8;
            data[i + 3] = 255;
        }
    }
    RgbaImage {
        width: w,
        height: h,
        data,
    }
}

pub fn noise_bg(w: u32, h: u32, seed: u32) -> RgbaImage {
    let mut data = vec![0u8; (w * h * 4) as usize];
    for y in 0..h {
        for x in 0..w {
            let i = ((y * w + x) * 4) as usize;
            let v = (x
                .wrapping_mul(17)
                .wrapping_add(y.wrapping_mul(31))
                .wrapping_add(seed))
                % 256;
            data[i] = v as u8;
            data[i + 1] = 255u8.wrapping_sub(v as u8);
            data[i + 2] = v.wrapping_mul(3) as u8;
            data[i + 3] = 255;
        }
    }
    RgbaImage {
        width: w,
        height: h,
        data,
    }
}

pub fn paint_rect(hay: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32, rgb: [u8; 3]) {
    for row in 0..h {
        for col in 0..w {
            let i = (((y + row) * hay.width + (x + col)) * 4) as usize;
            hay.data[i..i + 3].copy_from_slice(&rgb);
        }
    }
}

pub fn paint_icon_block(hay: &mut RgbaImage, x: u32, y: u32, size: u32) {
    for row in 0..size {
        for col in 0..size {
            let i = (((y + row) * hay.width + (x + col)) * 4) as usize;
            let c = match (row + col) % 4 {
                0 => [220, 60, 40],
                1 => [40, 180, 220],
                2 => [80, 200, 60],
                _ => [200, 180, 50],
            };
            hay.data[i..i + 3].copy_from_slice(&c);
        }
    }
}

pub fn paint_stripes(hay: &mut RgbaImage, x: u32, y: u32, w: u32, h: u32) {
    for row in 0..h {
        for col in 0..w {
            let i = (((y + row) * hay.width + (x + col)) * 4) as usize;
            let v = if row % 3 == 0 { 230 } else { 90 };
            hay.data[i] = v;
            hay.data[i + 1] = v / 2;
            hay.data[i + 2] = 255 - v;
        }
    }
}

pub fn crop_needle(hay: &RgbaImage, x: u32, y: u32, w: u32, h: u32) -> RgbaImage {
    let mut data = Vec::with_capacity((w * h * 4) as usize);
    for row in 0..h {
        for col in 0..w {
            let i = (((y + row) * hay.width + (x + col)) * 4) as usize;
            data.extend_from_slice(&hay.data[i..i + 4]);
        }
    }
    RgbaImage {
        width: w,
        height: h,
        data,
    }
}

pub fn default_opts() -> MatchOptions {
    MatchOptions {
        confidence: CONFIDENCE,
        search_region: None,
        multi_scale: false,
        scale_min: 0.8,
        scale_max: 1.2,
        scale_step: 0.1,
    }
}

pub fn build_find_scenarios() -> Vec<Scenario> {
    let mut out = Vec::new();

    {
        let mut hay = solid(64, 64, [40, 40, 40]);
        paint_rect(&mut hay, 10, 15, 8, 8, [240, 20, 20]);
        let needle = crop_needle(&hay, 10, 15, 8, 8);
        out.push(Scenario {
            name: "solid_patch_64",
            hay,
            needle,
            expected: (10, 15),
            opts: default_opts(),
            tol: 0,
        });
    }

    {
        let mut hay = gradient_bg(400, 300);
        paint_icon_block(&mut hay, 120, 80, 32);
        let needle = crop_needle(&hay, 120, 80, 32, 32);
        out.push(Scenario {
            name: "gradient_icon_400x300",
            hay,
            needle,
            expected: (120, 80),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = gradient_bg(320, 240);
        paint_icon_block(&mut hay, 200, 160, 8);
        let needle = crop_needle(&hay, 200, 160, 8, 8);
        out.push(Scenario {
            name: "tiny_icon_8x8",
            hay,
            needle,
            expected: (200, 160),
            opts: default_opts(),
            tol: 0,
        });
    }

    {
        let mut hay = solid(200, 160, [25, 25, 30]);
        paint_stripes(&mut hay, 40, 60, 48, 20);
        let needle = crop_needle(&hay, 40, 60, 48, 20);
        out.push(Scenario {
            name: "stripe_pattern",
            hay,
            needle,
            expected: (40, 60),
            opts: default_opts(),
            tol: 0,
        });
    }

    {
        let mut hay = solid(480, 120, [28, 28, 32]);
        paint_rect(&mut hay, 180, 48, 56, 14, [0, 180, 255]);
        let needle = crop_needle(&hay, 180, 48, 56, 14);
        out.push(Scenario {
            name: "wide_toolbar_chip",
            hay,
            needle,
            expected: (180, 48),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = solid(160, 400, [32, 32, 36]);
        paint_rect(&mut hay, 24, 200, 14, 40, [255, 200, 0]);
        let needle = crop_needle(&hay, 24, 200, 14, 40);
        out.push(Scenario {
            name: "tall_sidebar_chip",
            hay,
            needle,
            expected: (24, 200),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = noise_bg(360, 280, 42);
        paint_rect(&mut hay, 88, 66, 20, 20, [255, 40, 40]);
        let needle = crop_needle(&hay, 88, 66, 20, 20);
        out.push(Scenario {
            name: "noise_background",
            hay,
            needle,
            expected: (88, 66),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = solid(240, 180, [50, 50, 50]);
        paint_rect(&mut hay, 100, 70, 24, 24, [58, 58, 58]);
        let needle = crop_needle(&hay, 100, 70, 24, 24);
        out.push(Scenario {
            name: "low_contrast_patch",
            hay,
            needle,
            expected: (100, 70),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = solid(200, 200, [30, 30, 30]);
        paint_icon_block(&mut hay, 15, 20, 12);
        paint_rect(&mut hay, 55, 20, 12, 12, [200, 50, 50]);
        let needle = crop_needle(&hay, 15, 20, 12, 12);
        let mut opts = default_opts();
        opts.search_region = Some(Region {
            left: 0,
            top: 0,
            width: 50,
            height: 80,
        });
        out.push(Scenario {
            name: "search_region_top_left",
            hay,
            needle,
            expected: (15, 20),
            opts,
            tol: 0,
        });
    }

    {
        let mut hay = solid(800, 600, [35, 35, 35]);
        paint_rect(&mut hay, 500, 400, 24, 24, [255, 120, 0]);
        let needle = crop_needle(&hay, 500, 400, 24, 24);
        out.push(Scenario {
            name: "medium_800x600",
            hay,
            needle,
            expected: (500, 400),
            opts: default_opts(),
            tol: TOL,
        });
    }

    {
        let mut hay = solid(2000, 1100, [40, 40, 40]);
        paint_rect(&mut hay, 1200, 700, 24, 24, [240, 30, 30]);
        let needle = crop_needle(&hay, 1200, 700, 24, 24);
        out.push(Scenario {
            name: "large_pyramid_center",
            hay,
            needle,
            expected: (1200, 700),
            opts: default_opts(),
            tol: 4,
        });
    }

    {
        let mut hay = solid(2000, 1100, [40, 40, 40]);
        paint_icon_block(&mut hay, 28, 32, 28);
        let needle = crop_needle(&hay, 28, 32, 28, 28);
        out.push(Scenario {
            name: "large_pyramid_topleft",
            hay,
            needle,
            expected: (28, 32),
            opts: default_opts(),
            tol: 4,
        });
    }

    {
        let mut hay = solid(2000, 1100, [40, 40, 40]);
        paint_icon_block(&mut hay, 1850, 980, 28);
        let needle = crop_needle(&hay, 1850, 980, 28, 28);
        out.push(Scenario {
            name: "large_pyramid_bottomright",
            hay,
            needle,
            expected: (1850, 980),
            opts: default_opts(),
            tol: 4,
        });
    }

    {
        let mut hay = solid(300, 200, [50, 50, 50]);
        paint_rect(&mut hay, 20, 30, 20, 20, [200, 0, 0]);
        paint_icon_block(&mut hay, 200, 120, 20);
        let needle = crop_needle(&hay, 20, 30, 20, 20);
        out.push(Scenario {
            name: "decoy_different_pattern",
            hay,
            needle,
            expected: (20, 30),
            opts: default_opts(),
            tol: 0,
        });
    }

    {
        let mut hay = solid(120, 120, [30, 30, 30]);
        paint_rect(&mut hay, 30, 30, 18, 18, [180, 50, 50]);
        let needle = crop_needle(&hay, 30, 30, 12, 12);
        let mut opts = default_opts();
        opts.multi_scale = true;
        opts.scale_min = 1.0;
        opts.scale_max = 1.6;
        opts.scale_step = 0.05;
        out.push(Scenario {
            name: "multiscale_1p5x",
            hay,
            needle,
            expected: (30, 30),
            opts,
            tol: 3,
        });
    }

    {
        let mut hay = solid(140, 140, [25, 25, 25]);
        paint_rect(&mut hay, 50, 50, 10, 10, [180, 60, 60]);
        let needle = crop_needle(&hay, 50, 50, 12, 12);
        let mut opts = default_opts();
        opts.multi_scale = true;
        opts.scale_min = 0.75;
        opts.scale_max = 1.0;
        opts.scale_step = 0.05;
        out.push(Scenario {
            name: "multiscale_0p8x",
            hay,
            needle,
            expected: (50, 50),
            opts,
            tol: 3,
        });
    }

    out
}
