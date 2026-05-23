import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type {
  OcrBuiltInModelProfileName,
  EnsureOcrModelsOptions,
  FetchFile,
  OcrDetectionConfig,
  OcrModelSource,
  OcrModelProfile,
  OcrRecognitionConfig,
  ResolvedOcrModels,
} from "./types";

const DEFAULT_MODEL_BASE_URL =
  "https://huggingface.co/monkt/paddleocr-onnx/resolve/main";
const DEFAULT_MODEL_MIRROR_BASE_URL =
  "https://hf-mirror.com/monkt/paddleocr-onnx/resolve/main";
const MOBILE_MODEL_BASE_URL =
  "https://huggingface.co/ilaylow/PP_OCRv5_mobile_onnx/resolve/main";
const MOBILE_MODEL_MIRROR_BASE_URL =
  "https://hf-mirror.com/ilaylow/PP_OCRv5_mobile_onnx/resolve/main";

export function ocrModelBaseUrl(): string {
  return (
    process.env.SPOTTERJS_OCR_MODEL_BASE_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_MODEL_BASE_URL
  );
}

export function ocrModelMirrorBaseUrl(): string {
  return (
    process.env.SPOTTERJS_OCR_MODEL_MIRROR_BASE_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_MODEL_MIRROR_BASE_URL
  );
}

export const PPOCRV5_SERVER_PROFILE: OcrModelProfile = {
  name: "ppocrv5-server",
  version: "0.1.0",
  files: [
    {
      name: "det.onnx",
      url: "detection/v5/det.onnx",
      sha256: "skip",
    },
    {
      name: "rec.onnx",
      url: "languages/chinese/rec.onnx",
      sha256: "skip",
    },
    {
      name: "dict.txt",
      url: "languages/chinese/dict.txt",
      sha256: "skip",
    },
  ],
  detection: {
    modelFile: "det.onnx",
    inputWidth: 960,
    inputHeight: 960,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    boxThreshold: 0.3,
  },
  recognition: {
    modelFile: "rec.onnx",
    dictionaryFile: "dict.txt",
    inputWidth: 320,
    inputHeight: 48,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
  },
};

export const PPOCRV5_MOBILE_PROFILE: OcrModelProfile = {
  name: "ppocrv5-mobile",
  version: "0.1.0",
  files: [
    {
      name: "det.onnx",
      url: `${MOBILE_MODEL_BASE_URL}/ppocrv5_det.onnx`,
      mirrorUrl: `${MOBILE_MODEL_MIRROR_BASE_URL}/ppocrv5_det.onnx`,
      sha256: "skip",
    },
    {
      name: "rec.onnx",
      url: `${MOBILE_MODEL_BASE_URL}/ppocrv5_rec.onnx`,
      mirrorUrl: `${MOBILE_MODEL_MIRROR_BASE_URL}/ppocrv5_rec.onnx`,
      sha256: "skip",
    },
    {
      name: "dict.txt",
      url: "languages/chinese/dict.txt",
      sha256: "skip",
    },
  ],
  detection: {
    modelFile: "det.onnx",
    inputWidth: 960,
    inputHeight: 960,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    boxThreshold: 0.3,
  },
  recognition: {
    modelFile: "rec.onnx",
    dictionaryFile: "dict.txt",
    inputWidth: 320,
    inputHeight: 48,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
  },
};

export function resolveOcrModelProfile(
  profile?: OcrBuiltInModelProfileName
): OcrModelProfile {
  if (!profile || profile === "server" || profile === "ppocrv5-server") {
    return PPOCRV5_SERVER_PROFILE;
  }
  if (profile === "mobile" || profile === "ppocrv5-mobile") {
    return PPOCRV5_MOBILE_PROFILE;
  }
  throw new Error(`unknown OCR model profile: ${profile}`);
}

export function defaultModelDir(): string {
  const env = process.env.SPOTTERJS_OCR_MODEL_DIR?.trim();
  if (env) return path.resolve(env);

  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || os.homedir();
    return path.join(base, "spotterjs", "ocr");
  }

  const cache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(cache, "spotterjs", "ocr");
}

export async function ensureOcrModels(
  options: EnsureOcrModelsOptions = {}
): Promise<ResolvedOcrModels> {
  const profile = options.profile ?? resolveOcrModelProfile(options.modelProfile);
  const rootDir = path.join(options.modelDir ?? defaultModelDir(), profile.name, profile.version);
  const fetchFile = options.fetchFile ?? defaultFetchFile;
  const files: Record<string, string> = {};

  fs.mkdirSync(rootDir, { recursive: true });

  for (const file of profile.files) {
    const target = path.join(rootDir, file.name);
    files[file.name] = target;

    if (fs.existsSync(target)) {
      verifySha256(fs.readFileSync(target), file.sha256, target);
      continue;
    }

    const { bytes } = await downloadModelFile(
      file,
      file.sha256,
      fetchFile,
      options.modelSource ?? envModelSource()
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }

  return { profile, rootDir, files };
}

export type ResolveLocalOcrModelsOptions = {
  modelDir: string;
  detFile?: string;
  recFile?: string;
  dictFile?: string;
  detInputWidth?: number;
  detInputHeight?: number;
  recInputWidth?: number;
  recInputHeight?: number;
  detInputName?: string;
  recInputName?: string;
};

export function resolveLocalOcrModels(
  options: ResolveLocalOcrModelsOptions
): ResolvedOcrModels {
  const rootDir = path.resolve(options.modelDir);
  const detName = options.detFile ?? "det.onnx";
  const recName = options.recFile ?? "rec.onnx";
  const dictName = options.dictFile ?? "dict.txt";
  const files = {
    [detName]: path.resolve(rootDir, detName),
    [recName]: path.resolve(rootDir, recName),
    [dictName]: path.resolve(rootDir, dictName),
  };

  for (const file of Object.values(files)) {
    if (!fs.existsSync(file)) {
      throw new Error(`OCR local model file does not exist: ${file}`);
    }
  }

  const detection: OcrDetectionConfig = {
    ...PPOCRV5_SERVER_PROFILE.detection,
    modelFile: detName,
    inputWidth: options.detInputWidth ?? PPOCRV5_SERVER_PROFILE.detection.inputWidth,
    inputHeight: options.detInputHeight ?? PPOCRV5_SERVER_PROFILE.detection.inputHeight,
    inputName: options.detInputName,
  };
  const recognition: OcrRecognitionConfig = {
    ...PPOCRV5_SERVER_PROFILE.recognition,
    modelFile: recName,
    dictionaryFile: dictName,
    inputWidth: options.recInputWidth ?? PPOCRV5_SERVER_PROFILE.recognition.inputWidth,
    inputHeight: options.recInputHeight ?? PPOCRV5_SERVER_PROFILE.recognition.inputHeight,
    inputName: options.recInputName,
  };

  return {
    rootDir,
    files,
    profile: {
      name: "ppocrv5-local",
      version: "local",
      files: [],
      detection,
      recognition,
    },
  };
}

async function defaultFetchFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download OCR model: ${url} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function downloadModelFile(
  file: { url: string; mirrorUrl?: string },
  sha256: string,
  fetchFile: FetchFile,
  source: OcrModelSource
): Promise<{ bytes: Buffer; url: string }> {
  const urls = modelDownloadUrls(file, source);
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const bytes = await fetchFile(url);
      verifySha256(bytes, sha256, url);
      return { bytes, url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${url}: ${msg}`);
    }
  }

  throw new Error(`failed to download OCR model from ${source} source(s): ${errors.join("; ")}`);
}

function modelDownloadUrls(
  file: { url: string; mirrorUrl?: string },
  source: OcrModelSource
): string[] {
  const { url, mirrorUrl } = file;

  if (/^https?:\/\//i.test(url) && mirrorUrl) {
    if (source === "origin") return [url];
    if (source === "mirror") return [mirrorUrl];
    return url === mirrorUrl ? [url] : [url, mirrorUrl];
  }
  if (/^https?:\/\//i.test(url)) return [url];

  const relative = url.replace(/^\/+/, "");
  const origin = `${ocrModelBaseUrl()}/${relative}`;
  const mirror = `${ocrModelMirrorBaseUrl()}/${relative}`;

  if (source === "origin") return [origin];
  if (source === "mirror") return [mirror];
  return origin === mirror ? [origin] : [origin, mirror];
}

function envModelSource(): OcrModelSource {
  const value = process.env.SPOTTERJS_OCR_MODEL_SOURCE?.trim().toLowerCase();
  if (value === "origin" || value === "mirror" || value === "auto") return value;
  return "auto";
}

function verifySha256(bytes: Buffer, expected: string, label: string): void {
  if (expected === "skip") return;

  if (/^0+$/.test(expected)) {
    throw new Error(
      `OCR model manifest for ${label} has placeholder sha256; provide a real profile or update the manifest`
    );
  }

  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`OCR model sha256 mismatch for ${label}: expected ${expected}, got ${actual}`);
  }
}
