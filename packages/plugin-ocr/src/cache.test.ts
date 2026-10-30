import { describe, expect, it, vi } from "vitest";
import type { OcrEngine, ResolvedOcrModels } from "./types";

const factory = vi.hoisted(() => vi.fn());
vi.mock("./onnx", () => ({ createOnnxOcrEngine: factory }));
import { createOcr } from "./index";

function models(name: string): ResolvedOcrModels {
  return {
    rootDir: name,
    files: { "det.onnx": `${name}/det.onnx`, "rec.onnx": `${name}/rec.onnx`, "dict.txt": `${name}/dict.txt` },
    profile: {
      name, version: "test", files: [],
      detection: { modelFile: "det.onnx", inputWidth: 8, inputHeight: 8, mean: [0, 0, 0], std: [1, 1, 1], boxThreshold: 0.3 },
      recognition: { modelFile: "rec.onnx", dictionaryFile: "dict.txt", inputWidth: 8, inputHeight: 8, mean: [0, 0, 0], std: [1, 1, 1] },
    },
  };
}

describe("OCR initialization recovery", () => {
  it("does not retain a failed engine when the same model is explicitly retried", async () => {
    const engine: OcrEngine = { read: vi.fn(async () => []) };
    factory.mockReset().mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValue(engine);
    const options = { models: models("retry-engine") };
    await expect(createOcr(options)).rejects.toThrow("provider unavailable");
    const client = await createOcr(options);
    expect(await client.read({ width: 1, height: 1, data: Buffer.alloc(4) })).toEqual([]);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("shares an in-flight engine and keeps it after initialization succeeds", async () => {
    let ready!: (engine: OcrEngine) => void;
    factory.mockReset().mockReturnValue(new Promise<OcrEngine>((resolve) => { ready = resolve; }));
    const options = { models: models("shared-engine") };
    const pending = [createOcr(options), createOcr(options)];
    expect(factory).toHaveBeenCalledTimes(1);
    ready({ read: async () => [] });
    await Promise.all(pending);
    await createOcr(options);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
