import { beforeEach, describe, expect, it, vi } from "vitest";

const startRecording = vi.fn();
const stopRecording = vi.fn();
const playRecording = vi.fn();

vi.mock("./native", () => ({
  loadNative: () => ({
    startRecording,
    stopRecording,
    playRecording,
  }),
}));

import { recording } from "./recording";

beforeEach(() => {
  startRecording.mockReset();
  stopRecording.mockReset();
  playRecording.mockReset();
});

describe("recording", () => {
  it("starts recording with native options", () => {
    recording.start({ moveThrottleMs: 24 });

    expect(startRecording).toHaveBeenCalledWith({ moveThrottleMs: 24 });
  });

  it("parses stopped recording JSON", () => {
    stopRecording.mockReturnValue(
      JSON.stringify({
        events: [{ type: "type", text: "hi", delayMs: 10 }],
        durationMs: 10,
      })
    );

    expect(recording.stop()).toEqual({
      events: [{ type: "type", text: "hi", delayMs: 10 }],
      durationMs: 10,
    });
  });

  it("plays object scripts through native JSON", () => {
    const script = {
      events: [{ type: "move", x: 1, y: 2, delayMs: 5 }],
      durationMs: 5,
    } as const;

    recording.play(script, { speed: 2 });

    expect(playRecording).toHaveBeenCalledWith(JSON.stringify(script), 2);
  });
});
