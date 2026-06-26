import { callNative } from "./errors";
import { loadNative } from "./native";

export type ScriptAction =
  | { type: "move"; x: number; y: number; delayMs: number }
  | { type: "click"; button: string; x: number; y: number; delayMs: number }
  | { type: "scroll"; dx: number; dy: number; delayMs: number }
  | { type: "keyDown"; key: string; delayMs: number }
  | { type: "keyUp"; key: string; delayMs: number }
  | { type: "type"; text: string; delayMs: number };

export type RecordedScript = {
  events: ScriptAction[];
  durationMs: number;
};

export type RecordingStartOptions = {
  moveThrottleMs?: number;
};

export type RecordingPlayOptions = {
  speed?: number;
};

export const recording = {
  start(options: RecordingStartOptions = {}): void {
    callNative("recording.start", { options }, () =>
      loadNative().startRecording({
        moveThrottleMs: options.moveThrottleMs,
      })
    );
  },

  stop(): RecordedScript {
    return callNative("recording.stop", {}, () =>
      JSON.parse(loadNative().stopRecording()) as RecordedScript
    );
  },

  play(script: RecordedScript | string, options: RecordingPlayOptions = {}): void {
    const json = typeof script === "string" ? script : JSON.stringify(script);
    callNative("recording.play", { speed: options.speed }, () =>
      loadNative().playRecording(json, options.speed ?? 1)
    );
  },
};
