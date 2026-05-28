import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { accessibility, configureHost } from "@spotterjs/core";
import { registerDesktopTools } from "./tools/desktop.js";
import { registerHostTools } from "./tools/host.js";
import { registerOcrTools } from "./tools/ocr.js";

export async function registerOptionalAndroidTools(
  server: McpServer,
  enabled: boolean
): Promise<void> {
  if (!enabled) return;
  const { registerAndroidTools } = await import("./tools/android.js");
  registerAndroidTools(server);
}

/** Start the Spotter MCP server on stdio with tools enabled from environment flags. */
export async function runSpotterMcp(): Promise<void> {
  const a11yEnabled =
    process.env.SPOTTERJS_A11Y === "1" ||
    process.env.SPOTTERJS_A11Y?.toLowerCase() === "true";
  const androidEnabled =
    process.env.SPOTTERJS_ANDROID === "1" ||
    process.env.SPOTTERJS_ANDROID?.toLowerCase() === "true";

  if (process.env.SPOTTERJS_WORKSPACE_ROOT) {
    configureHost({
      workspaceRoot: process.env.SPOTTERJS_WORKSPACE_ROOT,
      allowShell:
        process.env.SPOTTERJS_ALLOW_SHELL === "1" ||
        process.env.SPOTTERJS_ALLOW_SHELL?.toLowerCase() === "true",
    });
  }

  const server = new McpServer({
    name: "spotterjs",
    version: "0.1.0",
  });

  registerHostTools(server);
  registerOcrTools(server);
  if (a11yEnabled) {
    accessibility.quick.enable();
  }
  registerDesktopTools(server, a11yEnabled);
  await registerOptionalAndroidTools(server, androidEnabled);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
