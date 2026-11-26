import { describe, expect, it } from "vitest";
import { SpotterError } from "@spotterjs/base";
import { z } from "zod";
import { CommandRegistry } from "../registry.js";
import { errorResult, json, ok, registerSafeTool } from "./results.js";
import { cliErrorResult } from "./results.js";

describe("command results", () => {
  it("returns structured text and JSON success data", () => {
    expect(ok()).toEqual({ success: true, data: "ok" });
    expect(ok("done")).toEqual({ success: true, data: "done" });
    expect(json({ a: 1 })).toEqual({ success: true, data: { a: 1 } });
  });

  it("preserves stable error codes, hints, and summarized context as structured fields", () => {
    const error = new SpotterError("SPOTTER_NATIVE_CAPTURE_FAILED", "boom", {
      domain: "native",
      hint: "Verify the screen is unlocked.",
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
        hint: "Verify the screen is unlocked.",
        context: {
          path: `${"x".repeat(177)}...`,
          attempts: [1, 2, 3, 4, 5],
          nested: { a: "[object]" },
        },
      },
    });
  });

  it("formats Zod validation issues cleanly with schema hint", async () => {
    const registry = new CommandRegistry();
    registerSafeTool(registry, "click_at", {
      inputSchema: { x: z.number(), y: z.number() },
    }, () => ok());

    const wrongType = await registry.execute("click_at", { x: "bad", y: 10 });
    expect(wrongType).toMatchObject({
      success: false,
      error: {
        code: "SPOTTER_CLI_INVALID_ARGUMENTS",
        domain: "cli",
        hint: 'Run "spotterjs schema click_at" to inspect the expected JSON input schema.',
      },
    });
    expect(wrongType.error?.message).toContain("x:");

    const extraKey = await registry.execute("click_at", { x: 1, y: 2, typo: true });
    expect(extraKey.error?.message).toContain("Unexpected field(s): typo");
    await registry.close();
  });

  it("formats top-level CLI errors including invalid JSON and SpotterError hints", () => {
    let parseErr: unknown;
    try {
      JSON.parse("{");
    } catch (e) {
      parseErr = e;
    }
    expect(cliErrorResult(parseErr)).toMatchObject({
      success: false,
      error: {
        code: "SPOTTER_CLI_INVALID_JSON",
        domain: "cli",
        hint: expect.stringContaining("--file"),
      },
    });

    const spotterErr = new SpotterError("SPOTTER_OCR_RUNTIME_LOAD_FAILED", "missing dll", {
      domain: "ocr",
      hint: "Install VC++ Redistributable.",
    });
    expect(cliErrorResult(spotterErr)).toEqual({
      success: false,
      error: {
        message: "missing dll",
        code: "SPOTTER_OCR_RUNTIME_LOAD_FAILED",
        domain: "ocr",
        hint: "Install VC++ Redistributable.",
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
