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

type ToolHandler = (args: any) => Promise<import("./results.js").CommandResult>;

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

describe("host CLI error handling", () => {
  it("returns CLI errors when host operations throw", async () => {
    coreHost.readFile.mockImplementation(() => {
      throw new Error("outside workspace");
    });

    const result = await registerTools().get("host_read_file")!({
      path: "../secret.txt",
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe(
      "host_read_file failed: outside workspace"
    );
  });
});
