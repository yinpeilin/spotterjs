use crate::error::{Result, SpotterError};
use crate::platform::{PlatformCapture, PlatformScreen, PlatformWindow};
use crate::types::{Region, RgbaImage, WindowId, WindowInfo};
use std::mem::size_of;
use std::path::Path;
use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, POINT, RECT};
use windows::Win32::Graphics::Gdi::{
    BitBlt, ClientToScreen, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    SRCCOPY,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::System::Threading::{
    AttachThreadInput, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW,
    PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, EnumWindows, GetForegroundWindow, GetSystemMetrics, GetWindowRect,
    GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
    SetForegroundWindow, SetWindowPos, ShowWindow, HWND_TOP, SM_CXSCREEN, SM_CYSCREEN,
    SWP_NOZORDER, SW_MINIMIZE, SW_RESTORE,
};

/// `PW_RENDERFULLCONTENT` (value 2) — use Xps `PRINT_WINDOW_FLAGS` for `PrintWindow`.
const PW_RENDERFULLCONTENT: PRINT_WINDOW_FLAGS = PRINT_WINDOW_FLAGS(2);

pub struct WindowsPlatform;

impl WindowsPlatform {
    pub fn new() -> Result<Self> {
        crate::platform::windows_input::ensure_dpi_aware();
        Ok(Self)
    }

    fn hwnd_from_id(id: WindowId) -> HWND {
        HWND(id.0 as *mut std::ffi::c_void)
    }

    fn id_from_hwnd(hwnd: HWND) -> WindowId {
        WindowId(hwnd.0 as usize as u64)
    }

    fn window_text(hwnd: HWND) -> String {
        unsafe {
            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                return String::new();
            }
            let mut buf = vec![0u16; (len + 1) as usize];
            let read = GetWindowTextW(hwnd, &mut buf);
            String::from_utf16_lossy(&buf[..read as usize])
        }
    }

    fn window_rect(hwnd: HWND) -> Result<Region> {
        unsafe {
            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect)
                .map_err(|e| SpotterError::Platform(format!("GetWindowRect: {e}")))?;
            Ok(Region {
                left: rect.left,
                top: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
            })
        }
    }

    /// Screen coordinates of the window client-area origin (0,0).
    pub(crate) fn client_screen_origin(id: WindowId) -> Result<(i32, i32)> {
        let hwnd = Self::hwnd_from_id(id);
        if hwnd.0.is_null() {
            return Err(SpotterError::InvalidWindowId(id.to_hex()));
        }
        unsafe {
            let mut pt = POINT { x: 0, y: 0 };
            if !ClientToScreen(hwnd, &mut pt).as_bool() {
                return Err(SpotterError::Platform("ClientToScreen failed".into()));
            }
            Ok((pt.x, pt.y))
        }
    }

    fn process_info(pid: u32) -> (String, Option<String>) {
        if pid == 0 {
            return ("unknown".into(), None);
        }
        unsafe {
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return ("unknown".into(), None);
            };
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buf.as_mut_ptr()),
                &mut len,
            );
            let _ = windows::Win32::Foundation::CloseHandle(handle);
            if ok.is_err() || len == 0 {
                return ("unknown".into(), None);
            }
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            let name = Path::new(&path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            (name, Some(path))
        }
    }

    fn build_info(hwnd: HWND) -> Result<WindowInfo> {
        let mut pid = 0u32;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
        }
        let (process_name, exe_path) = Self::process_info(pid);
        let foreground = unsafe {
            let fg = GetForegroundWindow();
            !fg.0.is_null() && fg == hwnd
        };
        Ok(WindowInfo {
            id: Self::id_from_hwnd(hwnd),
            title: Self::window_text(hwnd),
            region: Self::window_rect(hwnd)?,
            process_id: pid,
            process_name,
            exe_path,
            is_minimized: unsafe { IsIconic(hwnd).as_bool() },
            is_foreground: foreground,
        })
    }
}

impl PlatformScreen for WindowsPlatform {
    fn screen_size(&self) -> Result<(i32, i32)> {
        unsafe { Ok((GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN))) }
    }
}

impl PlatformWindow for WindowsPlatform {
    fn list_windows(&self) -> Result<Vec<WindowInfo>> {
        let mut out: Vec<WindowInfo> = Vec::new();
        unsafe {
            EnumWindows(Some(enum_callback), LPARAM(&mut out as *mut _ as isize))
                .map_err(|e| SpotterError::Platform(format!("EnumWindows: {e}")))?;
        }
        out.sort_by(|a, b| a.title.cmp(&b.title));
        Ok(out)
    }

    fn active_window(&self) -> Result<WindowInfo> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return Err(SpotterError::WindowNotFound("no foreground window".into()));
            }
            Self::build_info(hwnd)
        }
    }

    fn window_region(&self, id: WindowId) -> Result<Region> {
        Self::window_rect(Self::hwnd_from_id(id))
    }

    fn focus_window(&self, id: WindowId) -> Result<()> {
        let hwnd = Self::hwnd_from_id(id);
        if hwnd.0.is_null() {
            return Err(SpotterError::InvalidWindowId(id.to_hex()));
        }

        const MAX_RETRIES: u32 = 3;
        for attempt in 0..MAX_RETRIES {
            unsafe {
                if IsIconic(hwnd).as_bool() {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                }

                let foreground = GetForegroundWindow();
                let fg_thread = windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(
                    foreground, None,
                );
                let target_thread =
                    windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, None);
                let current = GetCurrentThreadId();

                if fg_thread != target_thread {
                    let _ = AttachThreadInput(current, fg_thread, true);
                    let _ = AttachThreadInput(current, target_thread, true);
                }

                let _ = BringWindowToTop(hwnd);
                let ok = SetForegroundWindow(hwnd);

                if fg_thread != target_thread {
                    let _ = AttachThreadInput(current, fg_thread, false);
                    let _ = AttachThreadInput(current, target_thread, false);
                }

                if ok.as_bool() || GetForegroundWindow() == hwnd {
                    return Ok(());
                }
            }

            if attempt + 1 == MAX_RETRIES {
                return Err(SpotterError::FocusDenied {
                    id: id.0,
                    reason: "SetForegroundWindow failed after retries".into(),
                });
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        Ok(())
    }

    fn move_window(&self, id: WindowId, x: i32, y: i32) -> Result<()> {
        let hwnd = Self::hwnd_from_id(id);
        let region = Self::window_rect(hwnd)?;
        unsafe {
            SetWindowPos(
                hwnd,
                Some(HWND_TOP),
                x,
                y,
                region.width,
                region.height,
                SWP_NOZORDER,
            )
            .map_err(|e| SpotterError::Platform(format!("SetWindowPos move: {e}")))?;
        }
        Ok(())
    }

    fn resize_window(&self, id: WindowId, width: i32, height: i32) -> Result<()> {
        let hwnd = Self::hwnd_from_id(id);
        let region = Self::window_rect(hwnd)?;
        unsafe {
            SetWindowPos(
                hwnd,
                Some(HWND_TOP),
                region.left,
                region.top,
                width,
                height,
                SWP_NOZORDER,
            )
            .map_err(|e| SpotterError::Platform(format!("SetWindowPos resize: {e}")))?;
        }
        Ok(())
    }

    fn minimize_window(&self, id: WindowId) -> Result<()> {
        let hwnd = Self::hwnd_from_id(id);
        unsafe {
            let _ = ShowWindow(hwnd, SW_MINIMIZE);
        }
        Ok(())
    }

    fn restore_window(&self, id: WindowId) -> Result<()> {
        let hwnd = Self::hwnd_from_id(id);
        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        Ok(())
    }

    fn client_origin(&self, id: WindowId) -> Result<(i32, i32)> {
        Self::client_screen_origin(id)
    }
}

unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let out = &mut *(lparam.0 as *mut Vec<WindowInfo>);
    if hwnd.0.is_null() {
        return BOOL(1);
    }
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let title = WindowsPlatform::window_text(hwnd);
        if title.trim().is_empty() {
            return BOOL(1);
        }
        if let Ok(info) = WindowsPlatform::build_info(hwnd) {
            if info.region.width > 0 && info.region.height > 0 {
                out.push(info);
            }
        }
    }
    BOOL(1)
}

impl PlatformCapture for WindowsPlatform {
    fn capture_screen(&self, region: Option<Region>) -> Result<RgbaImage> {
        unsafe {
            let hdc_screen = GetDC(None);
            if hdc_screen.is_invalid() {
                return Err(SpotterError::CaptureFailed("GetDC failed".into()));
            }

            let (x, y, w, h) = match region {
                Some(r) => (r.left, r.top, r.width, r.height),
                None => (
                    0,
                    0,
                    GetSystemMetrics(SM_CXSCREEN),
                    GetSystemMetrics(SM_CYSCREEN),
                ),
            };

            if w <= 0 || h <= 0 {
                let _ = ReleaseDC(None, hdc_screen);
                return Err(SpotterError::CaptureFailed("invalid capture region".into()));
            }

            let result = capture_hdc_region(hdc_screen, x, y, w, h);
            let _ = ReleaseDC(None, hdc_screen);
            result
        }
    }

    fn capture_window(&self, id: WindowId) -> Result<RgbaImage> {
        let hwnd = WindowsPlatform::hwnd_from_id(id);
        if hwnd.0.is_null() {
            return Err(SpotterError::WindowNotFound(id.to_hex()));
        }

        let region = WindowsPlatform::window_rect(hwnd)?;
        if region.width <= 0 || region.height <= 0 {
            return Err(SpotterError::CaptureFailed("window has zero size".into()));
        }

        // Try PrintWindow first
        if let Ok(img) = capture_print_window(hwnd, region.width, region.height) {
            return Ok(img);
        }

        // Fallback: capture screen region
        self.capture_screen(Some(region))
    }
}

fn capture_print_window(hwnd: HWND, width: i32, height: i32) -> Result<RgbaImage> {
    unsafe {
        let hdc_window = GetDC(Some(hwnd));
        if hdc_window.is_invalid() {
            return Err(SpotterError::CaptureFailed("GetDC window failed".into()));
        }
        let hdc_mem = CreateCompatibleDC(Some(hdc_window));
        if hdc_mem.is_invalid() {
            let _ = ReleaseDC(Some(hwnd), hdc_window);
            return Err(SpotterError::CaptureFailed(
                "CreateCompatibleDC failed".into(),
            ));
        }

        let w = width;
        let h = height;
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
        let hbm = CreateDIBSection(Some(hdc_mem), &bmi, DIB_RGB_COLORS, &mut bits, None, 0);
        let hbm = match hbm {
            Ok(b) if !b.is_invalid() && !bits.is_null() => b,
            _ => {
                let _ = DeleteDC(hdc_mem);
                let _ = ReleaseDC(Some(hwnd), hdc_window);
                return Err(SpotterError::CaptureFailed(
                    "CreateDIBSection failed".into(),
                ));
            }
        };

        let old = SelectObject(hdc_mem, HGDIOBJ(hbm.0));
        let printed = PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT).as_bool();
        if !printed {
            let _ = SelectObject(hdc_mem, old);
            let _ = DeleteObject(HGDIOBJ(hbm.0));
            let _ = DeleteDC(hdc_mem);
            let _ = ReleaseDC(Some(hwnd), hdc_window);
            return Err(SpotterError::CaptureFailed("PrintWindow failed".into()));
        }

        let byte_len = (w as u32 * h as u32 * 4) as usize;
        let mut data = std::slice::from_raw_parts(bits as *const u8, byte_len).to_vec();
        super::bgra::bgra_to_rgba_inplace(&mut data);

        let _ = SelectObject(hdc_mem, old);
        let _ = DeleteObject(HGDIOBJ(hbm.0));
        let _ = DeleteDC(hdc_mem);
        let _ = ReleaseDC(Some(hwnd), hdc_window);

        Ok(RgbaImage {
            width: w as u32,
            height: h as u32,
            data,
        })
    }
}

fn capture_hdc_region(
    hdc_src: windows::Win32::Graphics::Gdi::HDC,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
) -> Result<RgbaImage> {
    unsafe {
        if w <= 0 || h <= 0 {
            return Err(SpotterError::CaptureFailed("invalid capture size".into()));
        }
        let hdc_mem = CreateCompatibleDC(Some(hdc_src));
        if hdc_mem.is_invalid() {
            return Err(SpotterError::CaptureFailed(
                "CreateCompatibleDC failed".into(),
            ));
        }

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
        let hbm = CreateDIBSection(Some(hdc_mem), &bmi, DIB_RGB_COLORS, &mut bits, None, 0);
        let hbm = match hbm {
            Ok(b) if !b.is_invalid() && !bits.is_null() => b,
            _ => {
                let _ = DeleteDC(hdc_mem);
                return Err(SpotterError::CaptureFailed(
                    "CreateDIBSection failed".into(),
                ));
            }
        };

        let old = SelectObject(hdc_mem, HGDIOBJ(hbm.0));
        let ok = BitBlt(hdc_mem, 0, 0, w, h, Some(hdc_src), x, y, SRCCOPY);
        if ok.is_err() {
            let _ = SelectObject(hdc_mem, old);
            let _ = DeleteObject(HGDIOBJ(hbm.0));
            let _ = DeleteDC(hdc_mem);
            return Err(SpotterError::CaptureFailed("BitBlt failed".into()));
        }

        let byte_len = (w as u32 * h as u32 * 4) as usize;
        let mut data = std::slice::from_raw_parts(bits as *const u8, byte_len).to_vec();
        super::bgra::bgra_to_rgba_inplace(&mut data);

        let _ = SelectObject(hdc_mem, old);
        let _ = DeleteObject(HGDIOBJ(hbm.0));
        let _ = DeleteDC(hdc_mem);

        Ok(RgbaImage {
            width: w as u32,
            height: h as u32,
            data,
        })
    }
}
