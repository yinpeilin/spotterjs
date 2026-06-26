use crate::error::{Result, SpotterError};
use crate::events::guard::is_synthetic_input;
use crate::events::listener::{start_listener, ListenerHandle, ListenerOptions};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum InputEvent {
    MouseMove {
        x: i32,
        y: i32,
        t_ms: u64,
    },
    MouseButton {
        button: String,
        pressed: bool,
        x: i32,
        y: i32,
        t_ms: u64,
    },
    Wheel {
        dx: i32,
        dy: i32,
        t_ms: u64,
    },
    Key {
        key: String,
        pressed: bool,
        t_ms: u64,
    },
}

impl InputEvent {
    pub fn t_ms(&self) -> u64 {
        match self {
            Self::MouseMove { t_ms, .. }
            | Self::MouseButton { t_ms, .. }
            | Self::Wheel { t_ms, .. }
            | Self::Key { t_ms, .. } => *t_ms,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScriptAction {
    Move {
        x: i32,
        y: i32,
        delay_ms: u64,
    },
    Click {
        button: String,
        x: i32,
        y: i32,
        delay_ms: u64,
    },
    Scroll {
        dx: i32,
        dy: i32,
        delay_ms: u64,
    },
    KeyDown {
        key: String,
        delay_ms: u64,
    },
    KeyUp {
        key: String,
        delay_ms: u64,
    },
    Type {
        text: String,
        delay_ms: u64,
    },
}

impl ScriptAction {
    pub fn delay_ms(&self) -> u64 {
        match self {
            Self::Move { delay_ms, .. }
            | Self::Click { delay_ms, .. }
            | Self::Scroll { delay_ms, .. }
            | Self::KeyDown { delay_ms, .. }
            | Self::KeyUp { delay_ms, .. }
            | Self::Type { delay_ms, .. } => *delay_ms,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RecordedScript {
    pub events: Vec<ScriptAction>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct RecordingOptions {
    pub move_throttle_ms: Option<u64>,
}

#[derive(Debug, Clone, Default)]
pub struct EventRecorder {
    actions: Vec<ScriptAction>,
    start_ms: Option<u64>,
    last_ms: Option<u64>,
}

impl EventRecorder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, event: InputEvent) {
        let t_ms = event.t_ms();
        let delay_ms = self.delay_for(t_ms);
        match event {
            InputEvent::MouseMove { x, y, .. } => {
                self.actions.push(ScriptAction::Move { x, y, delay_ms });
            }
            InputEvent::MouseButton {
                button,
                pressed,
                x,
                y,
                ..
            } => {
                if !pressed {
                    self.actions.push(ScriptAction::Click {
                        button,
                        x,
                        y,
                        delay_ms,
                    });
                }
            }
            InputEvent::Wheel { dx, dy, .. } => {
                self.actions.push(ScriptAction::Scroll { dx, dy, delay_ms });
            }
            InputEvent::Key { key, pressed, .. } => {
                if pressed {
                    self.actions.push(ScriptAction::KeyDown { key, delay_ms });
                } else {
                    self.actions.push(ScriptAction::KeyUp { key, delay_ms });
                }
            }
        }
    }

    pub fn finish(self) -> RecordedScript {
        RecordedScript {
            duration_ms: match (self.start_ms, self.last_ms) {
                (Some(start), Some(last)) => last.saturating_sub(start),
                _ => 0,
            },
            events: self.actions,
        }
    }

    fn delay_for(&mut self, t_ms: u64) -> u64 {
        let start = *self.start_ms.get_or_insert(t_ms);
        let delay = self
            .last_ms
            .map(|last| t_ms.saturating_sub(last))
            .unwrap_or_else(|| t_ms.saturating_sub(start));
        self.last_ms = Some(t_ms);
        delay
    }
}

struct RecordingSession {
    recorder: Arc<Mutex<EventRecorder>>,
    listener: ListenerHandle,
}

static RECORDING: Mutex<Option<RecordingSession>> = Mutex::new(None);

pub fn start_recording(options: RecordingOptions) -> Result<()> {
    let mut active = RECORDING.lock();
    if active.is_some() {
        return Err(SpotterError::Platform("recording already active".into()));
    }

    let recorder = Arc::new(Mutex::new(EventRecorder::new()));
    let sink_recorder = recorder.clone();
    let listener = start_listener(
        ListenerOptions {
            move_throttle_ms: options.move_throttle_ms.unwrap_or(16),
        },
        Box::new(move |event| {
            if !is_synthetic_input() {
                sink_recorder.lock().push(event);
            }
        }),
    )?;
    *active = Some(RecordingSession { recorder, listener });
    Ok(())
}

pub fn stop_recording() -> Result<RecordedScript> {
    let mut active = RECORDING.lock();
    let Some(session) = active.take() else {
        return Err(SpotterError::Platform("recording is not active".into()));
    };
    session.listener.stop();
    let recorder = std::mem::take(&mut *session.recorder.lock());
    Ok(recorder.finish())
}
