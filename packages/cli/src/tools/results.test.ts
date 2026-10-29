import { describe, expect, it } from "vitest";
import { SpotterError } from "@spotterjs/base";
import { z } from "zod";
import { CommandRegistry } from "../registry.js";
import { errorResult, json, ok, registerSafeTool } from "./results.js";

describe("command results", () => {
  it("returns structured text and JSON success data", () => {
    expect(ok()).toEqual({ success: true, data: "ok" });
    expect(ok("done")).toEqual({ success: true, data: "done" });
    expect(json({ a: 1 })).toEqual({ success: true, data: { a: 1 } });
  });

  it("preserves stable error codes and summarized context as structured fields", () => {
    const error = new SpotterError("SPOTTER_NATIVE_CAPTURE_FAILED", "boom", {
      domain: "native",
      context: {
        path: "x".repeat(220),
        attempts: [1, 2, 3, 4, 5, 6],
        nested: { a: { b: { c: "too deep" } } },
      },
    });
    expect(errorResult("desktop_capture", error)).toEqual({
      success: false,
      error: {
        message: "desktop_capture failed: boom",
        code: "SPOTTER_NATIVE_CAPTURE_FAILED",
        domain: "native",
        context: {
          path: `${"x".repeat(177)}...`,
          attempts: [1, 2, 3, 4, 5],
          nested: { a: "[object]" },
        },
      },
    });
  });

  it("registers a handler that converts operational errors", async () => {
    const registry = new CommandRegistry();
    registerSafeTool<{ value: string }>(registry, "safe_command", {
      inputSchema: { value: z.string() },
    }, async ({ value }) => {
      if (value === "bad") throw new Error("bad value");
      return ok(value);
    });
    await expect(registry.execute("safe_command", { value: "good" })).resolves.toEqual(ok("good"));
    await expect(registry.execute("safe_command", { value: "bad" })).resolves.toEqual({
      success: false,
      error: { message: "safe_command failed: bad value" },
    });
    await registry.close();
  });
});
