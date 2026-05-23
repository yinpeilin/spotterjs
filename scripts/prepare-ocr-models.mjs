#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}

const det = args.get("--det");
const rec = args.get("--rec");
const dict = args.get("--dict");
const outDir = resolve(args.get("--out") || "test-output/ocr-models");
const baseUrl = args.get("--base-url") || "";

if (!det || !rec || !dict) {
  console.error(
    "Usage: node scripts/prepare-ocr-models.mjs --det DET_INFER_DIR --rec REC_INFER_DIR --dict DICT_TXT --out OUT_DIR [--base-url URL]"
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const outputs = [
  { name: "det.onnx", source: det },
  { name: "rec.onnx", source: rec },
];

for (const item of outputs) {
  const output = join(outDir, item.name);
  if (!existsSync(output)) {
    run("paddle2onnx", [
      "--model_dir",
      item.source,
      "--model_filename",
      "inference.pdmodel",
      "--params_filename",
      "inference.pdiparams",
      "--save_file",
      output,
    ]);
  }
}

const dictOut = join(outDir, "dict.txt");
writeFileSync(dictOut, readFileSync(dict));

const files = [join(outDir, "det.onnx"), join(outDir, "rec.onnx"), dictOut].map((file) => ({
  name: basename(file),
  url: baseUrl ? `${baseUrl.replace(/\/$/, "")}/${basename(file)}` : basename(file),
  sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
}));

writeFileSync(
  join(outDir, "manifest.json"),
  JSON.stringify({ profile: "ppocrv5-mobile", files }, null, 2)
);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
