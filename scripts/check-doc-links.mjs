#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "target",
  "test-output",
  "dist",
  "coverage",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function isIgnoredTarget(rawTarget) {
  return (
    rawTarget === "" ||
    rawTarget.startsWith("#") ||
    rawTarget.startsWith("http://") ||
    rawTarget.startsWith("https://") ||
    rawTarget.startsWith("mailto:") ||
    rawTarget.startsWith("tel:") ||
    rawTarget.startsWith("ftp://") ||
    rawTarget.startsWith("data:")
  );
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith("<") && target.includes(">")) {
    target = target.slice(1, target.indexOf(">"));
  } else {
    target = target.split(/\s+/)[0] ?? "";
  }

  const hashIndex = target.indexOf("#");
  if (hashIndex >= 0) {
    target = target.slice(0, hashIndex);
  }

  const queryIndex = target.indexOf("?");
  if (queryIndex >= 0) {
    target = target.slice(0, queryIndex);
  }

  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function resolveTarget(markdownFile, target) {
  if (path.isAbsolute(target)) {
    return path.join(repoRoot, target);
  }

  if (target.startsWith("/")) {
    return path.join(repoRoot, target.slice(1));
  }

  return path.resolve(path.dirname(markdownFile), target);
}

function existsAsMarkdownTarget(resolved) {
  if (fs.existsSync(resolved)) {
    return true;
  }

  if (!path.extname(resolved) && fs.existsSync(`${resolved}.md`)) {
    return true;
  }

  return false;
}

const markdownFiles = walk(repoRoot);
const failures = [];
const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(linkPattern)) {
    const target = normalizeTarget(match[1]);
    if (isIgnoredTarget(target)) {
      continue;
    }

    const resolved = resolveTarget(file, target);
    if (!existsAsMarkdownTarget(resolved)) {
      failures.push({
        file: path.relative(repoRoot, file),
        target,
      });
    }
  }
}

if (failures.length > 0) {
  console.error("Markdown link check failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.target}`);
  }
  process.exit(1);
}

console.log(`Markdown link check passed (${markdownFiles.length} files).`);
