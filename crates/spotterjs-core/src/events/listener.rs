use crate::error::Result;
use crate::events::recorder::InputEvent;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

pub type EventSink = Box<dyn Fn(InputEvent) + Send + 'static>;

#[derive(Debug, Clone, Copy)]
pub struct ListenerOptions {
    pub move_throttle_ms: u64,
}

impl Default for ListenerOptions {
    fn default() -> Self {
        Self {
            move_throttle_ms: 16,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ListenerHandle {
    running: Arc<AtomicBool>,
}

impl ListenerHandle {
    pub fn new(running: Arc<AtomicBool>) -> Self {
        Self { running }
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}

#[cfg(feature = "input-listen")]
pub fn start_listener(options: ListenerOptions, sink: EventSink) -> Result<ListenerHandle> {
    use parking_lot::Mutex;
    use rdev::{listen, Event, EventType};
    use std::thread;
    use std::time::Instant;

    let running = Arc::new(AtomicBool::new(true));
    let thread_running = running.clone();
    let started = Instant::now();
    let last_move = Arc::new(Mutex::new(0u64));
    let last_position = Arc::new(Mutex::new((0i32, 0i32)));

    thread::spawn(move || {
        let callback_running = thread_running.clone();
        let callback_last_move = last_move.clone();
        let callback_last_position = last_position.clone();
        let callback = move |event: Event| {
            if !callback_running.load(Ordering::SeqCst) {
                return;
            }
            let t_ms = started.elapsed().as_millis().min(u64::MAX as u128) as u64;
            let input = match event.event_type {
                EventType::MouseMove { x, y } => {
                    let mut last = callback_last_move.lock();
                    if t_ms.saturating_sub(*last) < options.move_throttle_ms {
                        return;
                    }
                    *last = t_ms;
                    let x = x.round() as i32;
                    let y = y.round() as i32;
                    *callback_last_position.lock() = (x, y);
                    InputEvent::MouseMove { x, y, t_ms }
                }
                EventType::ButtonPress(button) => {
                    let (x, y) = *callback_last_position.lock();
                    InputEvent::MouseButton {
                        button: button_name(button).into(),
                        pressed: true,
                        x,
                        y,
                        t_ms,
                    }
                }
                EventType::ButtonRelease(button) => {
                    let (x, y) = *callback_last_position.lock();
                    InputEvent::MouseButton {
                        button: button_name(button).into(),
                        pressed: false,
                        x,
                        y,
                        t_ms,
                    }
                }
                EventType::Wheel { delta_x, delta_y } => InputEvent::Wheel {
                    dx: delta_x as i32,
                    dy: delta_y as i32,
                    t_ms,
                },
                EventType::KeyPress(key) => InputEvent::Key {
                    key: format!("{key:?}"),
                    pressed: true,
                    t_ms,
                },
                EventType::KeyRelease(key) => InputEvent::Key {
                    key: format!("{key:?}"),
                    pressed: false,
                    t_ms,
                },
            };
            sink(input);
        };
        let _ = listen(callback);
    });

    Ok(ListenerHandle::new(running))
}

#[cfg(feature = "input-listen")]
fn button_name(button: rdev::Button) -> &'static str {
    match button {
        rdev::Button::Left => "left",
        rdev::Button::Right => "right",
        rdev::Button::Middle => "middle",
        _ => "unknown",
    }
}

#[cfg(not(feature = "input-listen"))]
pub fn start_listener(_options: ListenerOptions, _sink: EventSink) -> Result<ListenerHandle> {
    Err(crate::error::SpotterError::UnsupportedPlatform)
}
