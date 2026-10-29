import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { installSkill, skillPath } from "./skill.js";

const temporary: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "spotter-skill-test-"));
  temporary.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error("Unexpected temporary directory");
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("skill installation boundaries", () => {
  it("refuses an overlapping source destination before creating nested files", () => {
    const target = join(skillPath, "nested-install");
    expect(() => installSkill(target, true)).toThrow("must not overlap");
    expect(existsSync(target)).toBe(false);
  });

  it("does not follow an existing destination directory junction even with force", () => {
    const target = fixture();
    const outside = fixture();
    writeFileSync(join(outside, "marker.txt"), "unchanged");
    symlinkSync(outside, join(target, "spotterjs"), process.platform === "win32" ? "junction" : "dir");
    expect(() => installSkill(target, true)).toThrow("symbolic link");
    expect(readdirSync(outside)).toEqual(["marker.txt"]);
    expect(readFileSync(join(outside, "marker.txt"), "utf8")).toBe("unchanged");
  });

  it("preflights nested junctions before overwriting existing skill content", () => {
    const target = fixture();
    const outside = fixture();
    const destination = join(target, "spotterjs");
    mkdirSync(destination);
    writeFileSync(join(destination, "SKILL.md"), "local changes");
    symlinkSync(outside, join(destination, "references"), process.platform === "win32" ? "junction" : "dir");
    expect(() => installSkill(target, true)).toThrow("symbolic link");
    expect(readFileSync(join(destination, "SKILL.md"), "utf8")).toBe("local changes");
    expect(readdirSync(outside)).toEqual([]);
  });
});
