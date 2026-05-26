import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import {
  createOcr,
  defaultModelDir,
  resolveLocalOcrModels,
  type OcrBuiltInModelProfileName,
  type OcrExecutionProvider,
  type OcrPreprocessOptions,
  type OcrTextLine,
} from "../../packages/plugin-ocr/src";
import { ensureOutputDir, info, runSmokeScript } from "../lib/log";

type Fixture = {
  name: string;
  width: number;
  height: number;
  background: string;
  items: TextItem[];
  requiredExpects?: string[];
  observes?: string[];
  optionalExpects?: string[];
};

type TextItem = {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  weight?: number;
};

type FixtureResult = {
  fixture: string;
  imagePath: string;
  text: string;
  lines: OcrTextLine[];
  requiredMatched: string[];
  requiredMissed: string[];
  observedMatched: string[];
  observedMissed: string[];
  optionalMissed: string[];
};

const OUT = path.join(ensureOutputDir(), "ocr-smoke");
const DEFAULT_PROFILE = "mobile";

const fixtures: Fixture[] = [
  {
    name: "english-save",
    width: 640,
    height: 220,
    background: "#ffffff",
    items: [
      { text: "Save", x: 88, y: 128, size: 88, color: "#0f766e", weight: 700 },
    ],
    requiredExpects: ["Save"],
  },
  {
    name: "english-settings",
    width: 760,
    height: 220,
    background: "#ffffff",
    items: [
      { text: "Settings", x: 74, y: 126, size: 84, color: "#111827", weight: 600 },
    ],
    requiredExpects: ["Setting"],
  },
  {
    name: "chinese-confirm",
    width: 520,
    height: 220,
    background: "#ffffff",
    items: [
      { text: "确定", x: 92, y: 130, size: 96, color: "#111827", weight: 700 },
    ],
    observes: ["确定"],
    optionalExpects: ["确"],
  },
  {
    name: "mixed-order-id",
    width: 820,
    height: 220,
    background: "#ffffff",
    items: [
      { text: "Order ID 2026", x: 58, y: 126, size: 74, color: "#1f2937", weight: 700 },
    ],
    observes: ["Order", "ID", "2026"],
  },
  {
    name: "low-contrast-small",
    width: 760,
    height: 220,
    background: "#f3f4f6",
    items: [
      { text: "低对比文字", x: 54, y: 126, size: 34, color: "#737373" },
    ],
    observes: ["低对比"],
  },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgFor(fixture: Fixture): string {
  const text = fixture.items
    .map(
      (item) =>
        `<text x="${item.x}" y="${item.y}" font-size="${item.size}" font-weight="${
          item.weight ?? 500
        }" fill="${item.color}" letter-spacing="0">${escapeXml(item.text)}</text>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${fixture.width}" height="${fixture.height}" viewBox="0 0 ${fixture.width} ${fixture.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${fixture.background}"/>
  <g font-family="Segoe UI, Microsoft YaHei, Arial, sans-serif" letter-spacing="0">
${text}
  </g>
</svg>`;
}

async function writeFixture(fixture: Fixture): Promise<string> {
  fs.mkdirSync(OUT, { recursive: true });
  const svg = svgFor(fixture);
  const svgPath = path.join(OUT, `${fixture.name}.svg`);
  const imagePath = path.join(OUT, `${fixture.name}.png`);
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(imagePath);
  return imagePath;
}

function normalize(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[：:]/g, ":")
    .replace(/[，。]/g, "")
    .toLowerCase();
}

function containsAnyLine(lines: OcrTextLine[], expected: string): boolean {
  const needle = normalize(expected);
  return lines.some((line) => normalize(line.text).includes(needle));
}

function assertGeometry(lines: OcrTextLine[], fixtureName: string): void {
  if (lines.length === 0) {
    throw new Error(`${fixtureName}: OCR returned no text lines`);
  }

  for (const line of lines) {
    if (!line.text.trim()) {
      throw new Error(`${fixtureName}: OCR returned an empty text line`);
    }
    if (line.region.width <= 0 || line.region.height <= 0) {
      throw new Error(
        `${fixtureName}: invalid region for "${line.text}": ${JSON.stringify(line.region)}`
      );
    }
    if (line.box.length !== 4) {
      throw new Error(`${fixtureName}: invalid box for "${line.text}"`);
    }
  }
}

function createClientOptions(): Parameters<typeof createOcr>[0] {
  const executionProviders = parseExecutionProviders(
    process.env.SPOTTERJS_OCR_EXECUTION_PROVIDERS
  );
  const preprocess = parsePreprocess(process.env.SPOTTERJS_OCR_PREPROCESS);
  const localModelDir = process.env.SPOTTERJS_OCR_MODEL_DIR?.trim();
  if (localModelDir) {
    return {
      executionProviders,
      preprocess,
      models: resolveLocalOcrModels({
        modelDir: localModelDir,
        detInputWidth: Number(process.env.SPOTTERJS_OCR_DET_WIDTH || 960),
        detInputHeight: Number(process.env.SPOTTERJS_OCR_DET_HEIGHT || 960),
        recInputWidth: Number(process.env.SPOTTERJS_OCR_REC_WIDTH || 320),
        recInputHeight: Number(process.env.SPOTTERJS_OCR_REC_HEIGHT || 48),
      }),
    };
  }

  const modelProfile = (process.env.SPOTTERJS_OCR_SMOKE_PROFILE ||
    process.env.SPOTTERJS_OCR_MODEL_PROFILE ||
    DEFAULT_PROFILE) as OcrBuiltInModelProfileName;

  return {
    modelProfile,
    executionProviders,
    preprocess,
    modelSource: process.env.SPOTTERJS_OCR_MODEL_SOURCE as Parameters<
      typeof createOcr
    >[0]["modelSource"],
  };
}

function parseExecutionProviders(value: string | undefined): readonly OcrExecutionProvider[] | undefined {
  const providers = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return providers?.length ? providers : undefined;
}

function parsePreprocess(value: string | undefined): OcrPreprocessOptions | boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "0" || normalized === "false" || normalized === "off") {
    return undefined;
  }
  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "default") {
    return true;
  }

  const options: OcrPreprocessOptions = {};
  for (const item of normalized.split(",")) {
    const token = item.trim();
    if (!token) continue;
    const [key, raw] = token.split("=");
    if (key === "scale") {
      options.scale = Number(raw);
    } else if (key === "grayscale") {
      options.grayscale = raw !== "false" && raw !== "0";
    } else if (key === "normalize") {
      options.normalize = raw !== "false" && raw !== "0";
    } else if (key === "sharpen") {
      options.sharpen = raw !== "false" && raw !== "0";
    }
  }
  return Object.keys(options).length ? options : true;
}

async function runFixture(
  ocr: Awaited<ReturnType<typeof createOcr>>,
  fixture: Fixture
): Promise<FixtureResult> {
  const imagePath = await writeFixture(fixture);
  const lines = await ocr.read(imagePath);
  assertGeometry(lines, fixture.name);

  const text = lines.map((line) => line.text).join(" | ");
  const requiredExpects = fixture.requiredExpects ?? [];
  const observes = fixture.observes ?? [];
  const requiredMissed = requiredExpects.filter(
    (expected) => !containsAnyLine(lines, expected)
  );
  const requiredMatched = requiredExpects.filter(
    (expected) => !requiredMissed.includes(expected)
  );
  const observedMissed = observes.filter((expected) => !containsAnyLine(lines, expected));
  const observedMatched = observes.filter((expected) => !observedMissed.includes(expected));
  const optionalMissed = (fixture.optionalExpects ?? []).filter(
    (expected) => !containsAnyLine(lines, expected)
  );

  if (requiredMissed.length) {
    throw new Error(
      `${fixture.name}: missed ${requiredMissed.join(", ")}; recognized: ${text || "<none>"}`
    );
  }

  return {
    fixture: fixture.name,
    imagePath,
    text,
    lines,
    requiredMatched,
    requiredMissed,
    observedMatched,
    observedMissed,
    optionalMissed,
  };
}

export async function run(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  info(`fixtures/output ${OUT}`);
  info(`default model cache ${defaultModelDir()}`);
  if (process.env.SPOTTERJS_OCR_EXECUTION_PROVIDERS) {
    info(`execution providers ${process.env.SPOTTERJS_OCR_EXECUTION_PROVIDERS}`);
  }
  if (process.env.SPOTTERJS_OCR_PREPROCESS) {
    info(`preprocess ${process.env.SPOTTERJS_OCR_PREPROCESS}`);
  }

  const ocr = await createOcr(createClientOptions());
  const results: FixtureResult[] = [];

  for (const fixture of fixtures) {
    const result = await runFixture(ocr, fixture);
    results.push(result);
    info(`${fixture.name}: ${result.text}`);
    if (result.observedMissed.length) {
      info(`${fixture.name}: observed misses ${result.observedMissed.join(", ")}`);
    }
    if (result.optionalMissed.length) {
      info(`${fixture.name}: optional misses ${result.optionalMissed.join(", ")}`);
    }
  }

  const summaryPath = path.join(OUT, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  info(`wrote ${summaryPath}`);
}

if (process.argv[1]?.replace(/\\/g, "/").includes("ocr-synthetic")) {
  void runSmokeScript("ocr-synthetic", run);
}
