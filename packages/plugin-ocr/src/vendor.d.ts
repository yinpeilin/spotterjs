declare module "onnxruntime-node" {
  export namespace InferenceSession {
    type ExecutionProviderConfig = string | Record<string, unknown>;
  }

  export class Tensor {
    constructor(type: "float32", data: Float32Array, dims: number[]);
  }

  export const InferenceSession: {
    create(path: string, options?: {
      executionProviders?: readonly InferenceSession.ExecutionProviderConfig[];
    }): Promise<{
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
      channels: number;
    };
  };

  type SharpInstance = {
    ensureAlpha(): SharpInstance;
    resize(width: number, height: number, options?: { fit?: "fill"; kernel?: "lanczos3" }): SharpInstance;
    grayscale(): SharpInstance;
    normalize(): SharpInstance;
    sharpen(): SharpInstance;
    raw(): SharpInstance;
    toBuffer(options: { resolveWithObject: true }): Promise<RawResult>;
  };

  export default function sharp(input: Buffer, options?: SharpOptions): SharpInstance;
}
