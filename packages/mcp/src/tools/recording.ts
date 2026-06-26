import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { recording } from "@spotterjs/core";
import { z } from "zod";
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

export function registerRecordingTools(server: McpServer): void {
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
