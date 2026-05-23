declare module "onnxruntime-node" {
  export class Tensor {
    constructor(type: "float32", data: Float32Array, dims: number[]);
  }

  export const InferenceSession: {
    create(path: string): Promise<{
      inputNames?: string[];
      run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
    }>;
  };
}

declare module "sharp" {
  type SharpOptions = {
    raw: {
      width: number;
      height: number;
      channels: 4;
    };
  };

  type RawResult = {
    data: Buffer;
    info: {
      width: number;
      height: number;
    };
  };

  type SharpInstance = {
    ensureAlpha(): SharpInstance;
    resize(width: number, height: number, options?: { fit?: "fill" }): SharpInstance;
    raw(): SharpInstance;
    toBuffer(options: { resolveWithObject: true }): Promise<RawResult>;
  };

  export default function sharp(input: Buffer, options?: SharpOptions): SharpInstance;
}
