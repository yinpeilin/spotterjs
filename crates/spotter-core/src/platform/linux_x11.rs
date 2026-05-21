use crate::error::{Result, SpotterError};
use crate::platform::{PlatformCapture, PlatformScreen, PlatformWindow};
use crate::types::{Region, RgbaImage, WindowId, WindowInfo};
use std::fs;
use x11rb::connection::Connection;
use x11rb::protocol::xproto::*;
use x11rb::rust_connection::RustConnection;
use x11rb::wrapper::ConnectionExt as _;

pub struct LinuxX11Platform {
    conn: RustConnection,
    screen_width: u16,
    screen_height: u16,
    root: Window,
}

impl LinuxX11Platform {
    pub fn new() -> Result<Self> {
        let (conn, screen_num) = RustConnection::connect(None)
            .map_err(|e| SpotterError::Platform(format!("X11 connect: {e}")))?;
        let screen = &conn.setup().roots[screen_num];
        Ok(Self {
            conn,
            screen_width: screen.width_in_pixels,
            screen_height: screen.height_in_pixels,
            root: screen.root,
        })
    }

    fn window_id(w: Window) -> WindowId {
        WindowId(w as u64)
    }

    fn xid(id: WindowId) -> Window {
        id.0 as Window
    }

    fn get_wm_name(&self, window: Window) -> String {
        if let Ok(reply) = self.conn.get_property(
            false,
            window,
            AtomEnum::WM_NAME,
            AtomEnum::STRING,
            0,
            1024,
        ) {
            if let Ok(r) = reply.reply() {
                if let Some(value) = r.value {
                    return String::from_utf8_lossy(&value).to_string();
                }
            }
        }
        if let Ok(reply) = self.conn.get_property(
            false,
            window,
            self.intern_atom("_NET_WM_NAME"),
            self.intern_atom("UTF8_STRING"),
            0,
            1024,
        ) {
            if let Ok(r) = reply.reply() {
                if let Some(value) = r.value {
                    return String::from_utf8_lossy(&value).to_string();
                }
            }
        }
        String::new()
    }

    fn intern_atom(&self, name: &str) -> Atom {
        self.conn
            .intern_atom(false, name.as_bytes())
            .ok()
            .and_then(|c| c.reply().ok())
            .map(|r| r.atom)
            .unwrap_or(Atom::from(0))
    }

    fn client_windows(&self) -> Result<Vec<Window>> {
        let prop = self.conn.get_property(
            false,
            self.root,
            self.intern_atom("_NET_CLIENT_LIST"),
            AtomEnum::WINDOW,
            0,
            1024,
        )?;
        let reply = prop.reply()?;
        let mut wins = Vec::new();
        if let Some(value) = reply.value {
            for chunk in value.chunks_exact(4) {
                let id = u32::from_ne_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
                wins.push(id);
            }
        }
        if wins.is_empty() {
            self.collect_mapped_children(self.root, &mut wins)?;
        }
        Ok(wins)
    }

    fn collect_mapped_children(&self, parent: Window, out: &mut Vec<Window>) -> Result<()> {
        let tree = self.conn.query_tree(parent)?.reply()?;
        for &child in &tree.children {
            let attrs = self.conn.get_window_attributes(child)?.reply()?;
            if attrs.map_state == MapState::VIEWABLE {
                let name = self.get_wm_name(child);
                if !name.trim().is_empty() {
                    out.push(child);
                } else {
                    self.collect_mapped_children(child, out)?;
                }
            }
        }
        Ok(())
    }

    fn geometry(&self, window: Window) -> Result<Region> {
        let geo = self.conn.get_geometry(window)?.reply()?;
        let mut left = geo.x as i32;
        let mut top = geo.y as i32;
        let mut cur = window;
        loop {
            let tree = self.conn.query_tree(cur)?.reply()?;
            if tree.parent == tree.root || tree.parent == 0 {
                break;
            }
            let pgeo = self.conn.get_geometry(tree.parent)?.reply()?;
            left += pgeo.x as i32;
            top += pgeo.y as i32;
            cur = tree.parent;
        }
        Ok(Region {
            left,
            top,
            width: geo.width as i32,
            height: geo.height as i32,
        })
    }

    fn wm_pid(&self, window: Window) -> u32 {
        let atom = self.intern_atom("_NET_WM_PID");
        if atom == Atom::from(0) {
            return 0;
        }
        if let Ok(reply) = self.conn.get_property(false, window, atom, AtomEnum::CARDINAL, 0, 1)
        {
            if let Ok(r) = reply.reply() {
                if let Some(value) = r.value {
                    if value.len() >= 4 {
                        return u32::from_ne_bytes([value[0], value[1], value[2], value[3]]);
                    }
                }
            }
        }
        0
    }

    fn process_info(pid: u32) -> (String, Option<String>) {
        if pid == 0 {
            return ("unknown".into(), None);
        }
        let comm_path = format!("/proc/{pid}/comm");
        let exe_path = format!("/proc/{pid}/exe");
        let name = fs::read_to_string(&comm_path)
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "unknown".into());
        let exe = fs::read_link(&exe_path)
            .ok()
            .map(|p| p.to_string_lossy().into_owned());
        (name, exe)
    }

    fn is_minimized(&self, window: Window) -> bool {
        let state_atom = self.intern_atom("_NET_WM_STATE");
        let hidden = self.intern_atom("_NET_WM_STATE_HIDDEN");
        if state_atom == Atom::from(0) {
            return false;
        }
        if let Ok(reply) = self.conn.get_property(
            false,
            window,
            state_atom,
            AtomEnum::ATOM,
            0,
            64,
        ) {
            if let Ok(r) = reply.reply() {
                if let Some(value) = r.value {
                    for chunk in value.chunks_exact(4) {
                        let atom = u32::from_ne_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
                        if Atom::from(atom) == hidden {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }

    fn active_window_id(&self) -> Option<Window> {
        let prop = self
            .conn
            .get_property(
                false,
                self.root,
                self.intern_atom("_NET_ACTIVE_WINDOW"),
                AtomEnum::WINDOW,
                0,
                1,
            )
            .ok()?;
        let reply = prop.reply().ok()?;
        let value = reply.value?;
        if value.len() < 4 {
            return None;
        }
        let id = u32::from_ne_bytes([value[0], value[1], value[2], value[3]]);
        if id == 0 {
            None
        } else {
            Some(id)
        }
    }

    fn build_info(&self, window: Window) -> Result<WindowInfo> {
        let pid = self.wm_pid(window);
        let (process_name, exe_path) = Self::process_info(pid);
        let active = self.active_window_id();
        Ok(WindowInfo {
            id: Self::window_id(window),
            title: self.get_wm_name(window),
            region: self.geometry(window)?,
            process_id: pid,
            process_name,
            exe_path,
            is_minimized: self.is_minimized(window),
            is_foreground: active == Some(window),
        })
    }
}

impl PlatformScreen for LinuxX11Platform {
    fn screen_size(&self) -> Result<(i32, i32)> {
        Ok((self.screen_width as i32, self.screen_height as i32))
    }
}

impl PlatformWindow for LinuxX11Platform {
    fn list_windows(&self) -> Result<Vec<WindowInfo>> {
        let mut result = Vec::new();
        for w in self.client_windows()? {
            if let Ok(info) = self.build_info(w) {
                if !info.title.trim().is_empty() && info.region.width > 0 && info.region.height > 0 {
                    result.push(info);
                }
            }
        }
        result.sort_by(|a, b| a.title.cmp(&b.title));
        Ok(result)
    }

    fn active_window(&self) -> Result<WindowInfo> {
        let prop = self.conn.get_property(
            false,
            self.root,
            self.intern_atom("_NET_ACTIVE_WINDOW"),
            AtomEnum::WINDOW,
            0,
            1,
        )?;
        let reply = prop.reply()?;
        let value = reply
            .value
            .ok_or_else(|| SpotterError::WindowNotFound("no active window".into()))?;
        if value.len() < 4 {
            return Err(SpotterError::WindowNotFound("no active window".into()));
        }
        let id = u32::from_ne_bytes([value[0], value[1], value[2], value[3]]);
        if id == 0 {
            return Err(SpotterError::WindowNotFound("no active window".into()));
        }
        self.build_info(id)
    }

    fn window_region(&self, id: WindowId) -> Result<Region> {
        self.geometry(Self::xid(id))
    }

    fn focus_window(&self, id: WindowId) -> Result<()> {
        let window = Self::xid(id);
        for attempt in 0..3 {
            let event = ClientMessageEvent {
                response_type: ClientMessageEvent::CLIENT_MESSAGE,
                format: 32,
                window: self.root,
                type_: self.intern_atom("_NET_ACTIVE_WINDOW"),
                data: [1, window, 0, 0, 0],
            };
            let mask = EventMask::SUBSTRUCTURE_NOTIFY | EventMask::SUBSTRUCTURE_REDIRECT;
            if self
                .conn
                .send_event(false, self.root, mask, event)
                .is_ok()
            {
                let _ = self.conn.flush();
                std::thread::sleep(std::time::Duration::from_millis(100));
                if let Ok(active) = self.active_window() {
                    if active.id == id {
                        return Ok(());
                    }
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
            let _ = attempt;
        }
        Err(SpotterError::FocusDenied {
            id: id.0,
            reason: "_NET_ACTIVE_WINDOW failed".into(),
        })
    }

    fn move_window(&self, id: WindowId, x: i32, y: i32) -> Result<()> {
        let window = Self::xid(id);
        let region = self.geometry(window)?;
        self.net_moveresize(window, x, y, region.width, region.height)
    }

    fn resize_window(&self, id: WindowId, width: i32, height: i32) -> Result<()> {
        let window = Self::xid(id);
        let region = self.geometry(window)?;
        self.net_moveresize(window, region.left, region.top, width, height)
    }

    fn minimize_window(&self, id: WindowId) -> Result<()> {
        self.net_wm_state(Self::xid(id), true, "_NET_WM_STATE_HIDDEN")
    }

    fn restore_window(&self, id: WindowId) -> Result<()> {
        self.net_wm_state(Self::xid(id), false, "_NET_WM_STATE_HIDDEN")
    }
}

impl LinuxX11Platform {
    fn net_moveresize(&self, window: Window, x: i32, y: i32, w: i32, h: i32) -> Result<()> {
        self.conn
            .configure_window(
                window,
                &ConfigureWindowAux::new()
                    .x(x as i16)
                    .y(y as i16)
                    .width(w as u32)
                    .height(h as u32),
            )
            .map_err(|e| SpotterError::Platform(format!("configure_window: {e}")))?;
        let _ = self.conn.flush();
        Ok(())
    }

    fn net_wm_state(&self, window: Window, add: bool, state: &str) -> Result<()> {
        let state_atom = self.intern_atom(state);
        let wm_state = self.intern_atom("_NET_WM_STATE");
        let data = if add { 1u32 } else { 0u32 };
        let event = ClientMessageEvent {
            response_type: ClientMessageEvent::CLIENT_MESSAGE,
            format: 32,
            window,
            type_: wm_state,
            data: [data, state_atom as u32, 0, 0, 0],
        };
        let mask = EventMask::SUBSTRUCTURE_NOTIFY | EventMask::SUBSTRUCTURE_REDIRECT;
        self.conn
            .send_event(false, self.root, mask, event)
            .map_err(|e| SpotterError::Platform(format!("_NET_WM_STATE: {e}")))?;
        let _ = self.conn.flush();
        Ok(())
    }
}

impl PlatformCapture for LinuxX11Platform {
    fn capture_screen(&self, region: Option<Region>) -> Result<RgbaImage> {
        let (x, y, w, h) = match region {
            Some(r) => (r.left as i16, r.top as i16, r.width as u16, r.height as u16),
            None => (0, 0, self.screen_width, self.screen_height),
        };
        if w == 0 || h == 0 {
            return Err(SpotterError::CaptureFailed("invalid region".into()));
        }
        let image = self
            .conn
            .get_image(
                ImageFormat::Z_PIXMAP,
                self.root,
                x,
                y,
                w,
                h,
                !0,
            )
            .map_err(|e| SpotterError::CaptureFailed(format!("XGetImage: {e}")))?
            .reply()
            .map_err(|e| SpotterError::CaptureFailed(format!("XGetImage reply: {e}")))?;

        let rgba = super::x11_image::pixels_to_rgba(image.depth, &image.data, w as u32, h as u32)?;
        Ok(RgbaImage {
            width: w as u32,
            height: h as u32,
            data: rgba,
        })
    }

    fn capture_window(&self, id: WindowId) -> Result<RgbaImage> {
        let window = Self::xid(id);
        let region = self.geometry(window)?;
        if region.width <= 0 || region.height <= 0 {
            return Err(SpotterError::CaptureFailed("zero window size".into()));
        }
        let image = self
            .conn
            .get_image(
                ImageFormat::Z_PIXMAP,
                window,
                0,
                0,
                region.width as u16,
                region.height as u16,
                !0,
            )
            .map_err(|e| SpotterError::CaptureFailed(format!("XGetImage window: {e}")))?
            .reply()
            .map_err(|e| SpotterError::CaptureFailed(format!("XGetImage reply: {e}")))?;

        let w = region.width as u32;
        let h = region.height as u32;
        let rgba = super::x11_image::pixels_to_rgba(image.depth, &image.data, w, h)?;
        Ok(RgbaImage {
            width: w,
            height: h,
            data: rgba,
        })
    }
}

