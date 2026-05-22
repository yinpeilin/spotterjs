//! In-process cache for needle images loaded from disk (keyed by canonical path + mtime).

use crate::error::{Result, SpotterError};
use crate::image::load_rgba_from_path;
use spotterjs_base::RgbaImage;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock};
use std::time::SystemTime;

const MAX_ENTRIES: usize = 32;

struct NeedleCache {
    order: Vec<PathBuf>,
    entries: HashMap<PathBuf, (SystemTime, Arc<RgbaImage>)>,
}

impl NeedleCache {
    fn new() -> Self {
        Self {
            order: Vec::new(),
            entries: HashMap::new(),
        }
    }

    fn touch(&mut self, key: &PathBuf) {
        if let Some(i) = self.order.iter().position(|p| p == key) {
            self.order.remove(i);
        }
        self.order.push(key.clone());
    }

    fn evict_if_needed(&mut self) {
        while self.entries.len() > MAX_ENTRIES {
            if let Some(old) = self.order.first().cloned() {
                self.order.remove(0);
                self.entries.remove(&old);
            } else {
                break;
            }
        }
    }

    fn get_or_load(&mut self, path: &Path) -> Result<RgbaImage> {
        let key = path
            .canonicalize()
            .map_err(|e| SpotterError::Image(format!("needle path {}: {e}", path.display())))?;
        let mtime = std::fs::metadata(&key)
            .map_err(|e| SpotterError::Image(format!("needle metadata {}: {e}", key.display())))?
            .modified()
            .map_err(|e| SpotterError::Image(format!("needle mtime {}: {e}", key.display())))?;

        if let Some((cached_mtime, img)) = self.entries.get(&key) {
            if *cached_mtime == mtime {
                let out = (**img).clone();
                self.touch(&key);
                return Ok(out);
            }
        }

        let img = load_rgba_from_path(&key)?;
        let arc = Arc::new(img);
        let is_new = !self.entries.contains_key(&key);
        self.entries.insert(key.clone(), (mtime, arc.clone()));
        if is_new {
            self.touch(&key);
            self.evict_if_needed();
        } else {
            self.touch(&key);
        }
        Ok((*arc).clone())
    }
}

static NEEDLE_CACHE: LazyLock<Mutex<NeedleCache>> = LazyLock::new(|| Mutex::new(NeedleCache::new()));

pub fn load_needle_cached(path: &Path) -> Result<RgbaImage> {
    NEEDLE_CACHE.lock().get_or_load(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn cache_reuses_unchanged_file() {
        let dir = std::env::temp_dir().join(format!("spotter_needle_cache_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("needle.png");
        {
            let img = image::RgbaImage::from_pixel(4, 4, image::Rgba([1, 2, 3, 255]));
            img.save(&path).expect("save png");
        }

        let first = load_needle_cached(&path).expect("first load");
        let second = load_needle_cached(&path).expect("second load");
        assert_eq!(first.width, second.width);
        assert_eq!(first.data, second.data);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn cache_invalidates_on_mtime_change() {
        let dir = std::env::temp_dir().join(format!("spotter_needle_cache_m_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("needle.png");
        {
            let img = image::RgbaImage::from_pixel(2, 2, image::Rgba([10, 20, 30, 255]));
            img.save(&path).expect("save png");
        }
        let first = load_needle_cached(&path).expect("first");
        assert_eq!(first.data[0], 10);

        std::thread::sleep(std::time::Duration::from_millis(50));
        {
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .truncate(true)
                .open(&path)
                .expect("open");
            let img = image::RgbaImage::from_pixel(2, 2, image::Rgba([99, 88, 77, 255]));
            let mut buf = Vec::new();
            image::DynamicImage::ImageRgba8(img)
                .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
                .expect("encode");
            file.write_all(&buf).expect("write");
        }

        let second = load_needle_cached(&path).expect("second");
        assert_eq!(second.data[0], 99);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
