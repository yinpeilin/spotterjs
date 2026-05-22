import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configureHost } from "@spotterjs/core";
import { registerDesktopTools } from "./tools/desktop.js";
import { registerHostTools } from "./tools/host.js";

export async function runSpotterMcp(): Promise<void> {
  const a11yEnabled =
    process.env.SPOTTERJS_A11Y === "1" ||
    process.env.SPOTTERJS_A11Y?.toLowerCase() === "true";

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
  registerDesktopTools(server, a11yEnabled);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
