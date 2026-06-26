use spotterjs_core::{
    guard_synthetic_input, is_synthetic_input, play_script_with, EventRecorder, InputEvent,
    PlaybackTarget, RecordedScript, ScriptAction,
};
use std::time::Duration;

#[test]
fn recorder_converts_events_to_relative_script_actions() {
    let mut recorder = EventRecorder::new();

    recorder.push(InputEvent::MouseMove {
        x: 10,
        y: 20,
        t_ms: 100,
    });
    recorder.push(InputEvent::MouseButton {
        button: "left".into(),
        pressed: false,
        x: 10,
        y: 20,
        t_ms: 150,
    });
    recorder.push(InputEvent::Wheel {
        dx: 0,
        dy: -3,
        t_ms: 175,
    });
    recorder.push(InputEvent::Key {
        key: "A".into(),
        pressed: true,
        t_ms: 200,
    });
    recorder.push(InputEvent::Key {
        key: "A".into(),
        pressed: false,
        t_ms: 230,
    });

    let script = recorder.finish();

    assert_eq!(script.duration_ms, 130);
    assert_eq!(
        script.events,
        vec![
            ScriptAction::Move {
                x: 10,
                y: 20,
                delay_ms: 0,
            },
            ScriptAction::Click {
                button: "left".into(),
                x: 10,
                y: 20,
                delay_ms: 50,
            },
            ScriptAction::Scroll {
                dx: 0,
                dy: -3,
                delay_ms: 25,
            },
            ScriptAction::KeyDown {
                key: "A".into(),
                delay_ms: 25,
            },
            ScriptAction::KeyUp {
                key: "A".into(),
                delay_ms: 30,
            },
        ]
    );
}

#[test]
fn recorded_script_json_roundtrips() {
    let script = RecordedScript {
        events: vec![ScriptAction::Type {
            text: "hello".into(),
            delay_ms: 12,
        }],
        duration_ms: 12,
    };

    let json = serde_json::to_string(&script).unwrap();
    let decoded: RecordedScript = serde_json::from_str(&json).unwrap();

    assert_eq!(decoded, script);
}

#[test]
fn synthetic_guard_is_active_only_inside_scope() {
    assert!(!is_synthetic_input());

    guard_synthetic_input(|| {
        assert!(is_synthetic_input());
    });

    assert!(!is_synthetic_input());
}

#[derive(Default)]
struct FakeTarget {
    calls: Vec<String>,
}

impl PlaybackTarget for FakeTarget {
    fn move_mouse(&mut self, x: i32, y: i32) -> spotterjs_core::Result<()> {
        self.calls.push(format!("move:{x},{y}"));
        Ok(())
    }

    fn click(&mut self, button: &str, x: i32, y: i32) -> spotterjs_core::Result<()> {
        self.calls.push(format!("click:{button}:{x},{y}"));
        Ok(())
    }

    fn scroll(&mut self, dx: i32, dy: i32) -> spotterjs_core::Result<()> {
        self.calls.push(format!("scroll:{dx},{dy}"));
        Ok(())
    }

    fn key_down(&mut self, key: &str) -> spotterjs_core::Result<()> {
        self.calls.push(format!("down:{key}"));
        Ok(())
    }

    fn key_up(&mut self, key: &str) -> spotterjs_core::Result<()> {
        self.calls.push(format!("up:{key}"));
        Ok(())
    }

    fn type_text(&mut self, text: &str) -> spotterjs_core::Result<()> {
        self.calls.push(format!("type:{text}"));
        Ok(())
    }
}

#[test]
fn player_dispatches_actions_and_scales_delays() {
    let script = RecordedScript {
        duration_ms: 40,
        events: vec![
            ScriptAction::Move {
                x: 1,
                y: 2,
                delay_ms: 10,
            },
            ScriptAction::Click {
                button: "right".into(),
                x: 3,
                y: 4,
                delay_ms: 20,
            },
            ScriptAction::Type {
                text: "ok".into(),
                delay_ms: 10,
            },
        ],
    };
    let mut target = FakeTarget::default();
    let mut sleeps = Vec::new();

    play_script_with(&script, 2.0, &mut target, |duration| {
        sleeps.push(duration);
    })
    .unwrap();

    assert_eq!(target.calls, vec!["move:1,2", "click:right:3,4", "type:ok"]);
    assert_eq!(
        sleeps,
        vec![
            Duration::from_millis(5),
            Duration::from_millis(10),
            Duration::from_millis(5),
        ]
    );
}
