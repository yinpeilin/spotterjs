import { describe, expect, it, vi } from "vitest";
import { SpotterError } from "@spotterjs/base";
import { errorResult, json, ok, registerSafeTool } from "./results";

describe("MCP tool results", () => {
  it("formats text and JSON success results", () => {
    expect(ok()).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(ok("done")).toEqual({ content: [{ type: "text", text: "done" }] });
    expect(json({ a: 1 })).toEqual({
      content: [{ type: "text", text: JSON.stringify({ a: 1 }, null, 2) }],
    });
  });

  it("includes stable code and summarized context in error results", () => {
    const error = new SpotterError("SPOTTER_NATIVE_CAPTURE_FAILED", "boom", {
      domain: "native",
      context: {
        path: "x".repeat(220),
        attempts: [1, 2, 3, 4, 5, 6],
        nested: { a: { b: { c: "too deep" } } },
      },
    });

    const result = errorResult("desktop_capture", error);
    const text = result.content[0].text;

    expect(result.isError).toBe(true);
    expect(text).toContain("desktop_capture failed: boom");
    expect(text).toContain("code=SPOTTER_NATIVE_CAPTURE_FAILED");
    expect(text).toContain("domain=native");
    expect(text).toContain(`${"x".repeat(177)}...`);
    expect(text).toContain('"attempts":[1,2,3,4,5]');
    expect(text).toContain('"a":"[object]"');
  });

  it("registers a safe handler that converts thrown errors", async () => {
    const handlers: Record<string, (args: unknown) => Promise<unknown>> = {};
    const server = {
      registerTool: vi.fn((name: string, _config: unknown, handler: (args: unknown) => Promise<unknown>) => {
        handlers[name] = handler;
      }),
    };

    registerSafeTool<{ value: string }>(
      server as never,
      "safe_tool",
      {},
      async ({ value }) => {
        if (value === "bad") throw new Error("bad value");
        return ok(value);
      }
    );

    await expect(handlers.safe_tool({ value: "good" })).resolves.toEqual(ok("good"));
    await expect(handlers.safe_tool({ value: "bad" })).resolves.toEqual({
      content: [{ type: "text", text: "safe_tool failed: bad value" }],
      isError: true,
    });
  });
});
