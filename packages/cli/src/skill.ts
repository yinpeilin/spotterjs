import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

export const skillPath = fileURLToPath(new URL("../skills/spotterjs/", import.meta.url));

function within(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}

function rejectSymlinks(directory: string): void {
  const metadata = lstatSync(directory, { throwIfNoEntry: false });
  if (!metadata) return;
  if (metadata.isSymbolicLink()) throw new Error(`Skill installation cannot follow a symbolic link: ${directory}`);
  if (metadata.isDirectory()) {
    for (const name of readdirSync(directory)) rejectSymlinks(join(directory, name));
  }
}

function identical(source: string, destination: string): boolean {
  return readdirSync(source, { withFileTypes: true }).every((entry) => {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (!existsSync(to)) return false;
    return entry.isDirectory()
      ? identical(from, to)
      : readFileSync(from).equals(readFileSync(to));
  });
}

/** Install into an explicit agent skill directory without replacing local edits. */
export function installSkill(target: string, force = false): string {
  const destination = resolve(target, "spotterjs");
  if (destination === resolve(skillPath)) return destination;
  if (within(resolve(skillPath), destination) || within(destination, resolve(skillPath)))
    throw new Error("Skill source and destination directories must not overlap");
  rejectSymlinks(destination);
  if (existsSync(destination) && !force) {
    if (identical(skillPath, destination)) return destination;
    throw new Error(`Skill already exists at ${destination}; use --force to replace it`);
  }
  mkdirSync(destination, { recursive: true });
  cpSync(skillPath, destination, { recursive: true });
  return destination;
}
