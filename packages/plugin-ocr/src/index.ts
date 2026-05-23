import type { CaptureImage, Point, Region } from "@spotterjs/base";
import { cropImage, loadImage } from "./image";
import {
  defaultModelDir,
  ensureOcrModels,
  ocrModelBaseUrl,
  ocrModelMirrorBaseUrl,
  PPOCRV5_MOBILE_PROFILE,
  PPOCRV5_SERVER_PROFILE,
  resolveOcrModelProfile,
  resolveLocalOcrModels,
} from "./models";
import { createOnnxOcrEngine } from "./onnx";
import { centerOf } from "./postprocess";
import type {
  CreateOcrOptions,
  EnsureOcrModelsOptions,
  OcrClient,
  OcrEngine,
  OcrFindOptions,
  OcrImage,
  OcrBuiltInModelProfileName,
  OcrModelProfile,
  OcrReadOptions,
  OcrSession,
  OcrTextLine,
} from "./types";

export {
  defaultModelDir,
  ensureOcrModels,
  ocrModelBaseUrl,
  ocrModelMirrorBaseUrl,
  PPOCRV5_MOBILE_PROFILE,
  PPOCRV5_SERVER_PROFILE,
  resolveOcrModelProfile,
  resolveLocalOcrModels,
};

export type {
  CreateOcrOptions,
  EnsureOcrModelsOptions,
  OcrClient,
  OcrEngine,
  OcrFindOptions,
  OcrImage,
  OcrBuiltInModelProfileName,
  OcrModelProfile,
  OcrReadOptions as OcrOptions,
  OcrReadOptions,
  OcrSession,
  OcrTextLine,
};

export async function createOcr(options: CreateOcrOptions = {}): Promise<OcrClient> {
  const engine =
    options.engine ??
    (await createOnnxOcrEngine(
      options.models ??
        (await ensureOcrModels({
          modelDir: options.modelDir,
          profile: options.profile,
          modelProfile: options.modelProfile,
          fetchFile: options.fetchFile,
          modelSource: options.modelSource,
        }))
    ));

  let client: OcrClient;
  client = {
    async read(image, readOptions) {
      const prepared = await prepareImage(image, readOptions);
      const lines = await engine.read(prepared.image);
      return lines.map((line) => translateLine(line, prepared.offset));
    },

    async findText(image, text, findOptions) {
      const matches = await this.findAllText(image, text, findOptions);
      if (!matches.length) {
        throw new Error(`OCR text not found: ${text}`);
      }
      return matches[0];
    },

    async findAllText(image, text, findOptions) {
      const lines = await client.read(image, findOptions);
      return lines.filter((line: OcrTextLine) => textMatches(line.text, text, findOptions));
    },
  };
  return client;
}

export async function useOcrPlugin(options?: CreateOcrOptions): Promise<OcrClient> {
  return createOcr(options);
}

async function prepareImage(
  source: OcrImage,
  options?: OcrReadOptions
): Promise<{ image: CaptureImage; offset: Point }> {
  const image = await loadImage(source);
  const origin = options?.origin ?? { x: 0, y: 0 };
  const searchRegion = options?.searchRegion;
  const cropped = cropImage(image, searchRegion);
  return {
    image: cropped,
    offset: {
      x: origin.x + (searchRegion?.left ?? 0),
      y: origin.y + (searchRegion?.top ?? 0),
    },
  };
}

function translateLine(line: OcrTextLine, offset: Point): OcrTextLine {
  const region: Region = {
    left: line.region.left + offset.x,
    top: line.region.top + offset.y,
    width: line.region.width,
    height: line.region.height,
  };

  return {
    ...line,
    region,
    box: line.box.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })) as OcrTextLine["box"],
    center: centerOf(region),
  };
}

function textMatches(actual: string, expected: string, options?: OcrFindOptions): boolean {
  const left = options?.caseSensitive ? actual : actual.toLowerCase();
  const right = options?.caseSensitive ? expected : expected.toLowerCase();
  return options?.exact ? left === right : left.includes(right);
}
