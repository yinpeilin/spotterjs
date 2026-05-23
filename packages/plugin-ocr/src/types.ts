import type { CaptureImage, Point, Region } from "@spotterjs/base";

export type OcrImage = CaptureImage | Buffer | string;

export type OcrTextLine = {
  text: string;
  score: number;
  region: Region;
  box: [Point, Point, Point, Point];
  center: Point;
};

export type OcrReadOptions = {
  origin?: Point;
  searchRegion?: Region;
};

export type OcrFindOptions = OcrReadOptions & {
  exact?: boolean;
  caseSensitive?: boolean;
};

export type OcrModelFile = {
  name: string;
  url: string;
  mirrorUrl?: string;
  sha256: string;
};

export type OcrDetectionConfig = {
  modelFile: string;
  inputWidth: number;
  inputHeight: number;
  mean: [number, number, number];
  std: [number, number, number];
  boxThreshold: number;
  inputName?: string;
};

export type OcrRecognitionConfig = {
  modelFile: string;
  dictionaryFile: string;
  inputWidth: number;
  inputHeight: number;
  mean: [number, number, number];
  std: [number, number, number];
  inputName?: string;
};

export type OcrModelProfile = {
  name: string;
  version: string;
  files: OcrModelFile[];
  detection: OcrDetectionConfig;
  recognition: OcrRecognitionConfig;
};

export type ResolvedOcrModels = {
  profile: OcrModelProfile;
  rootDir: string;
  files: Record<string, string>;
};

export type FetchFile = (url: string) => Promise<Buffer>;

export type OcrModelSource = "auto" | "origin" | "mirror";
export type OcrBuiltInModelProfileName =
  | "server"
  | "mobile"
  | "ppocrv5-server"
  | "ppocrv5-mobile";

export type EnsureOcrModelsOptions = {
  modelDir?: string;
  profile?: OcrModelProfile;
  modelProfile?: OcrBuiltInModelProfileName;
  fetchFile?: FetchFile;
  modelSource?: OcrModelSource;
};

export type OcrSession = {
  inputNames?: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export type OcrEngine = {
  read(image: CaptureImage): Promise<OcrTextLine[]>;
};

export type CreateOcrOptions = EnsureOcrModelsOptions & {
  engine?: OcrEngine;
  models?: ResolvedOcrModels;
};

export type OcrClient = {
  read(image: OcrImage, options?: OcrReadOptions): Promise<OcrTextLine[]>;
  findText(
    image: OcrImage,
    text: string,
    options?: OcrFindOptions
  ): Promise<OcrTextLine>;
  findAllText(
    image: OcrImage,
    text: string,
    options?: OcrFindOptions
  ): Promise<OcrTextLine[]>;
};
