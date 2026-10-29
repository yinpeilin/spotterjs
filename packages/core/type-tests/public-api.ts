import type { MatchOptions, MatchResult } from "../src";
import { accessibility, keyboard } from "../src";

const releaseAccessibility: () => void = accessibility.disable;
void releaseAccessibility;

keyboard.type("中文 😀 !@#$\nline\ttab", { autoDelayMs: 0 });
keyboard.write("paste", { mode: "paste", pasteDelayMs: 600 });

const opts: MatchOptions = {
  confidence: 0.9,
  region: { left: 0, top: 0, width: 100, height: 100 },
  scale: { min: 0.8, max: 1.2, step: 0.05 },
};

void opts;

const result: MatchResult = {
  region: { left: 1, top: 2, width: 3, height: 4 },
  center: { x: 2, y: 4 },
  score: 0.9,
  matchScore: 0.9,
  matchAlgorithm: "ncc",
};

void result;

// @ts-expect-error searchRegion was removed from the public API.
const legacyRegion: MatchOptions = { searchRegion: { left: 0, top: 0, width: 1, height: 1 } };

// @ts-expect-error multiScale was replaced by scale.
const legacyScaleFlag: MatchOptions = { multiScale: true };

// @ts-expect-error scaleMin was replaced by scale.min.
const legacyScaleBounds: MatchOptions = { scaleMin: 0.8 };

void legacyRegion;
void legacyScaleFlag;
void legacyScaleBounds;
