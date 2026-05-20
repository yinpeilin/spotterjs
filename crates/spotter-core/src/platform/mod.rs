use crate::error::{Result, SpotterError};
use crate::types::{Region, RgbaImage, WindowId, WindowInfo};

pub(crate) trait PlatformScreen: Send + Sync {
    fn screen_size(&self) -> Result<(i32, i32)>;
}

pub(crate) trait PlatformWindow: PlatformScreen + Send + Sync {
    fn list_windows(&self) -> Result<Vec<WindowInfo>>;
    fn active_window(&self) -> Result<WindowInfo>;
    fn window_region(&self, id: WindowId) -> Result<Region>;
    fn window_region_clamped(&self, id: WindowId) -> Result<Region> {
        let region = self.window_region(id)?;
        let (sw, sh) = self.screen_size()?;
        Ok(region.clamp_to_screen(sw, sh))
    }
    fn focus_window(&self, id: WindowId) -> Result<()>;
    fn move_window(&self, id: WindowId, x: i32, y: i32) -> Result<()>;
    fn resize_window(&self, id: WindowId, width: i32, height: i32) -> Result<()>;
    fn minimize_window(&self, id: WindowId) -> Result<()>;
    fn restore_window(&self, id: WindowId) -> Result<()>;
}

pub(crate) trait PlatformCapture: Send + Sync {
    fn capture_screen(&self, region: Option<Region>) -> Result<RgbaImage>;
    fn capture_window(&self, id: WindowId) -> Result<RgbaImage>;
}

pub(crate) struct Platform {
    #[cfg(windows)]
    inner: windows::WindowsPlatform,
    #[cfg(all(target_os = "linux", feature = "linux-x11"))]
    inner: linux_x11::LinuxX11Platform,
}

impl Platform {
    pub fn new() -> Result<Self> {
        Ok(Self {
            #[cfg(windows)]
            inner: windows::WindowsPlatform::new()?,
            #[cfg(all(target_os = "linux", feature = "linux-x11"))]
            inner: linux_x11::LinuxX11Platform::new()?,
        })
    }
}

macro_rules! delegate {
    ($self:expr, $method:ident $(, $arg:expr)*) => {{
        #[cfg(windows)]
        return $self.inner.$method($($arg),*);
        #[cfg(all(target_os = "linux", feature = "linux-x11"))]
        return $self.inner.$method($($arg),*);
        #[cfg(not(any(windows, all(target_os = "linux", feature = "linux-x11"))))]
        {
            let _ = ($($arg),*);
            Err(SpotterError::UnsupportedPlatform)
        }
    }};
}

impl PlatformScreen for Platform {
    fn screen_size(&self) -> Result<(i32, i32)> {
        delegate!(self, screen_size)
    }
}

impl PlatformWindow for Platform {
    fn list_windows(&self) -> Result<Vec<WindowInfo>> {
        delegate!(self, list_windows)
    }

    fn active_window(&self) -> Result<WindowInfo> {
        delegate!(self, active_window)
    }

    fn window_region(&self, id: WindowId) -> Result<Region> {
        delegate!(self, window_region, id)
    }

    fn window_region_clamped(&self, id: WindowId) -> Result<Region> {
        delegate!(self, window_region_clamped, id)
    }

    fn focus_window(&self, id: WindowId) -> Result<()> {
        delegate!(self, focus_window, id)
    }

    fn move_window(&self, id: WindowId, x: i32, y: i32) -> Result<()> {
        delegate!(self, move_window, id, x, y)
    }

    fn resize_window(&self, id: WindowId, width: i32, height: i32) -> Result<()> {
        delegate!(self, resize_window, id, width, height)
    }

    fn minimize_window(&self, id: WindowId) -> Result<()> {
        delegate!(self, minimize_window, id)
    }

    fn restore_window(&self, id: WindowId) -> Result<()> {
        delegate!(self, restore_window, id)
    }
}

impl PlatformCapture for Platform {
    fn capture_screen(&self, region: Option<Region>) -> Result<RgbaImage> {
        delegate!(self, capture_screen, region)
    }

    fn capture_window(&self, id: WindowId) -> Result<RgbaImage> {
        delegate!(self, capture_window, id)
    }
}

pub(crate) mod x11_image;

#[cfg(windows)]
pub mod windows;

#[cfg(all(target_os = "linux", feature = "linux-x11"))]
pub mod linux_x11;

pub fn platform() -> Result<Platform> {
    Platform::new()
}
