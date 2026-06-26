pub mod guard;
pub mod hotkey;
pub mod listener;
pub mod player;
pub mod recorder;

pub use guard::{guard_synthetic_input, is_synthetic_input};
pub use hotkey::{Hotkey, HotkeyRegistry};
pub use listener::{start_listener, EventSink, ListenerHandle, ListenerOptions};
pub use player::{
    play_script, play_script_json, play_script_with, NativePlaybackTarget, PlaybackTarget,
};
pub use recorder::{
    start_recording, stop_recording, EventRecorder, InputEvent, RecordedScript, RecordingOptions,
    ScriptAction,
};
