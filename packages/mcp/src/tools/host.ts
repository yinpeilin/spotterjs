import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { host } from "@spotterjs/core";
import { json, ok, registerSafeTool } from "./results.js";

const finiteNumber = z.number().finite();
const workspacePathSchema = z
  .string()
  .describe("Path inside SPOTTERJS_WORKSPACE_ROOT. Relative paths are resolved from the workspace root.");

export function registerHostTools(server: McpServer): void {
  registerSafeTool(
    server,
    "host_read_file",
    {
      description: "Read a text file inside SPOTTERJS_WORKSPACE_ROOT",
      inputSchema: z.object({ path: workspacePathSchema }),
    },
    async ({ path: filePath }) => {
      const text = host.readFile(filePath) as string;
      return ok(text);
    }
  );

  registerSafeTool(
    server,
    "host_write_file",
    {
      description: "Write a text file inside the workspace sandbox",
      inputSchema: z.object({
        path: workspacePathSchema,
        content: z.string().describe("Text content to write."),
      }),
    },
    async ({ path: filePath, content }) => {
      host.writeFile(filePath, content);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "host_list_dir",
    {
      description: "List directory entries inside the workspace sandbox",
      inputSchema: z.object({
        path: workspacePathSchema.optional().describe("Workspace directory path. Defaults to '.'."),
      }),
    },
    async ({ path: dirPath }) => {
      const entries = host.listDir(dirPath ?? ".");
      return json(entries);
    }
  );

  registerSafeTool(
    server,
    "host_stat",
    {
      description: "Return file or directory metadata inside the workspace sandbox",
      inputSchema: z.object({ path: workspacePathSchema }),
    },
    async ({ path: filePath }) => {
      const st = host.stat(filePath);
      return json(st);
    }
  );

  registerSafeTool(
    server,
    "host_open_file",
    {
      description: "Open a file or folder with the OS default application",
      inputSchema: z.object({ path: workspacePathSchema }),
    },
    async ({ path: filePath }) => {
      host.openPath(filePath);
      return ok();
    }
  );

  registerSafeTool(
    server,
    "host_shell_info",
    {
      description:
        "Returns the shell used for host_exec (PowerShell on Windows, bash on Linux)",
    },
    async () => {
      const info = host.getShellInfo();
      return json(info);
    }
  );

  registerSafeTool(
    server,
    "host_exec",
    {
      description:
        "Run a command in the workspace shell (requires SPOTTERJS_ALLOW_SHELL=1)",
      inputSchema: z.object({
        command: z.string().describe("Shell command to run."),
        cwd: workspacePathSchema
          .optional()
          .describe("Working directory inside the workspace. Defaults to workspace root."),
        timeoutMs: finiteNumber
          .min(0)
          .max(300_000)
          .optional()
          .describe("Command timeout in milliseconds, capped at 300000."),
      }),
    },
    async ({ command, cwd, timeoutMs }) => {
      const result = await host.exec(command, { cwd, timeoutMs });
      return json(result);
    }
  );
}
