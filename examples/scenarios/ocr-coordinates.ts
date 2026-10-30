/** Deterministic OCR geometry contract; injected engine, no model download. */
import assert from "node:assert/strict";
import { createOcr } from "@spotterjs/plugin-ocr";

async function main() {
  const ocr = await createOcr({
    engine: {
      async read(capture) {
        assert.equal(capture.width, 8);
        assert.equal(capture.height, 8);
        return [{
          text: "Settings", score: 0.99,
          region: { left: 1, top: 2, width: 4, height: 4 },
          box: [{ x: 1, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 6 }, { x: 1, y: 6 }],
          center: { x: 3, y: 4 },
        }];
      },
    },
  });
  const match = await ocr.findText({ width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4) }, "Settings", {
    exact: true, searchRegion: { left: 4, top: 3, width: 8, height: 8 }, origin: { x: 100, y: 200 },
  });
  assert.deepEqual(match.center, { x: 107, y: 207 });
  console.log(JSON.stringify({ engine: "injected-fixture", match }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
