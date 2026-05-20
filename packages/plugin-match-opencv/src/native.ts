export type OpenCvNative = {
  matcherName(): string;
  findTemplate(
    haystack: { data: Buffer; width: number; height: number },
    needlePath: string,
    needleBuffer: Buffer | null | undefined,
    opts?: unknown
  ): { left: number; top: number; width: number; height: number };
  findAllTemplates(
    haystack: { data: Buffer; width: number; height: number },
    needlePath: string,
    needleBuffer: Buffer | null | undefined,
    opts?: unknown
  ): Array<{ left: number; top: number; width: number; height: number }>;
};

export function loadOpenCvNative(): OpenCvNative {
  return require("@spotter-rs/node-match-opencv") as OpenCvNative;
}
