import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { host } from "@spotter/core";

export function registerHostTools(server: McpServer): void {
  server.registerTool(
    "host_read_file",
    {
      description: "Read a text file inside SPOTTER_WORKSPACE_ROOT",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path: filePath }) => {
      const text = host.readFile(filePath) as string;
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "host_write_file",
    {
      description: "Write a text file inside the workspace sandbox",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
    },
    async ({ path: filePath, content }) => {
      host.writeFile(filePath, content);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "host_list_dir",
    {
      inputSchema: z.object({ path: z.string().optional() }),
    },
    async ({ path: dirPath }) => {
      const entries = host.listDir(dirPath ?? ".");
      return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
    }
  );

  server.registerTool(
    "host_stat",
    { inputSchema: z.object({ path: z.string() }) },
    async ({ path: filePath }) => {
      const st = host.stat(filePath);
      return { content: [{ type: "text", text: JSON.stringify(st, null, 2) }] };
    }
  );

  server.registerTool(
    "host_open_file",
    {
      description: "Open a file or folder with the OS default application",
      inputSchema: z.object({ path: z.string() }),
    },
    async ({ path: filePath }) => {
      host.openPath(filePath);
      return { content: [{ type: "text", text: "ok" }] };
    }
  );

  server.registerTool(
    "host_shell_info",
    {
      description:
        "Returns the shell used for host_exec (PowerShell on Windows, bash on Linux)",
    },
    async () => {
      const info = host.getShellInfo();
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    }
  );

  server.registerTool(
    "host_exec",
    {
      description:
        "Run a command in the workspace shell (requires SPOTTER_ALLOW_SHELL=1)",
      inputSchema: z.object({
        command: z.string(),
        cwd: z.string().optional(),
        timeoutMs: z.number().optional(),
      }),
    },
    async ({ command, cwd, timeoutMs }) => {
      const result = await host.exec(command, { cwd, timeoutMs });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
