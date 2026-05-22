use spotterjs_base::Region;

pub fn window_blocked(blocked: &[bool], hay_w: u32, nw: u32, nh: u32, ox: u32, oy: u32) -> bool {
    for ty in 0..nh {
        for tx in 0..nw {
            let idx = ((oy + ty) * hay_w + (ox + tx)) as usize;
            if idx < blocked.len() && blocked[idx] {
                return true;
            }
        }
    }
    false
}

pub fn mark_region_blocked(blocked: &mut [bool], hay_w: u32, region: &Region) {
    let x0 = region.left.max(0) as u32;
    let y0 = region.top.max(0) as u32;
    let x1 = (region.left + region.width) as u32;
    let y1 = (region.top + region.height) as u32;
    for y in y0..y1 {
        for x in x0..x1 {
            let idx = (y * hay_w + x) as usize;
            if idx < blocked.len() {
                blocked[idx] = true;
            }
        }
    }
}

pub fn regions_overlap(a: &Region, b: &Region) -> bool {
    let dx = (a.left - b.left).abs();
    let dy = (a.top - b.top).abs();
    dx < a.width / 2 && dy < a.height / 2
}

pub fn dedupe_regions(regions: Vec<Region>) -> Vec<Region> {
    let mut out = Vec::new();
    for r in regions {
        if !out.iter().any(|o| regions_overlap(o, &r)) {
            out.push(r);
        }
    }
    out
}
