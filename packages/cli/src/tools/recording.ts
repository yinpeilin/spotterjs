import type { CommandRegistry } from "../registry.js";
import { recording } from "@spotterjs/core";
import { z } from "zod";
import { waitForDelay } from "../execution.js";
import { json, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const positiveNumber = finiteNumber.positive();

const scriptSchema = z
  .union([
    z.string().describe("Recorded script JSON string."),
    z.object({
      events: z.array(z.any()).describe("Recorded script actions."),
      durationMs: finiteNumber.min(0).describe("Total recorded duration in milliseconds."),
    }),
  ])
  .describe("Recorded script object or JSON string returned by desktop_stop_recording.");

export function registerRecordingTools(server: CommandRegistry): void {
  let active = false;
  server.registerCleanup(() => {
    if (!active) return;
    recording.stop();
    active = false;
  });
  registerSafeTool(
    server,
    "desktop_record_input",
    {
      description: "Record desktop input for a fixed duration in this CLI process and return the replayable script.",
      inputSchema: {
        durationMs: finiteNumber.min(1).max(300_000).describe("Recording duration in milliseconds, up to 300000."),
        moveThrottleMs: positiveNumber.optional(),
      },
    },
    async ({ durationMs, moveThrottleMs }, context) => {
      recording.start({ moveThrottleMs });
      active = true;
      let script;
      try {
        await waitForDelay(durationMs, context?.signal);
      } finally {
        script = recording.stop();
        active = false;
      }
      return json({ script, scriptJson: JSON.stringify(script) });
    }
  );
  registerSafeTool(
    server,
    "desktop_start_recording",
    {
      description:
        "Start recording global desktop mouse and keyboard input into a replayable JSON script.",
      inputSchema: z
        .object({
          moveThrottleMs: positiveNumber
            .optional()
            .describe("Minimum milliseconds between recorded mouse-move events."),
        })
        .shape,
    },
    async (args) => {
      recording.start({ moveThrottleMs: args.moveThrottleMs });
      active = true;
      return json({ recording: true });
    }
  );

  registerSafeTool(
    server,
    "desktop_stop_recording",
    {
      description:
        "Stop desktop input recording. Returns the parsed script and scriptJson for later playback.",
      inputSchema: {},
    },
    async () => {
      const script = recording.stop();
      active = false;
      return json({ script, scriptJson: JSON.stringify(script) });
    }
  );

  registerSafeTool(
    server,
    "desktop_play_recording",
    {
      description:
        "Replay a recorded desktop input script. Input can be the script object or JSON string returned by desktop_stop_recording.",
      inputSchema: z
        .object({
          script: scriptSchema,
          speed: positiveNumber
            .optional()
            .describe("Playback speed multiplier. Defaults to 1."),
        })
        .shape,
    },
    async (args) => {
      recording.play(args.script, { speed: args.speed });
      return json({ played: true });
    }
  );
}
