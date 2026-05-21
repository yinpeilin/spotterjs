import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configureHost } from "@spotter/core";
import { registerDesktopTools } from "./tools/desktop.js";
import { registerHostTools } from "./tools/host.js";

export async function runSpotterMcp(): Promise<void> {
  const a11yEnabled =
    process.env.SPOTTER_A11Y === "1" ||
    process.env.SPOTTER_A11Y?.toLowerCase() === "true";

  if (process.env.SPOTTER_WORKSPACE_ROOT) {
    configureHost({
      workspaceRoot: process.env.SPOTTER_WORKSPACE_ROOT,
      allowShell:
        process.env.SPOTTER_ALLOW_SHELL === "1" ||
        process.env.SPOTTER_ALLOW_SHELL?.toLowerCase() === "true",
    });
  }

  const server = new McpServer({
    name: "spotter",
    version: "0.1.0",
  });

  registerHostTools(server);
  registerDesktopTools(server, a11yEnabled);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
