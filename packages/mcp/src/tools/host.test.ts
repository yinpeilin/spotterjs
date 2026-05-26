import { beforeEach, describe, expect, it, vi } from "vitest";

const coreHost = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  listDir: vi.fn(),
  stat: vi.fn(),
  openPath: vi.fn(),
  getShellInfo: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("@spotterjs/core", () => ({
  host: coreHost,
}));

import { registerHostTools } from "./host.js";

type ToolHandler = (args: any) => Promise<{ content: Array<{ text?: string }>; isError?: boolean }>;

function registerTools(): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };

  registerHostTools(server as never);
  return tools;
}

beforeEach(() => {
  for (const fn of Object.values(coreHost)) fn.mockReset();
});

describe("host MCP error handling", () => {
  it("returns MCP errors when host operations throw", async () => {
    coreHost.readFile.mockImplementation(() => {
      throw new Error("outside workspace");
    });

    const result = await registerTools().get("host_read_file")!({
      path: "../secret.txt",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(
      "host_read_file failed: outside workspace"
    );
  });
});
