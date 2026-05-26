import {
  type CaptureImage,
  type TemplateImage,
} from "@spotterjs/base";

import { findAllNeedleInCapture, findNeedleInCapture } from "./match";
import { loadNative } from "./native";

function loadImageFromBuffer(bytes: Buffer): CaptureImage {
  return loadNative().loadImageFromBuffer(bytes);
}

export const image = {
  /** Decode encoded PNG/JPEG/WebP bytes into a raw RGBA capture. */
  decode(bytes: Buffer): CaptureImage {
    return loadImageFromBuffer(bytes);
  },

  /** Match a template against an existing raw RGBA capture. */
  find: findNeedleInCapture,

  /** Return all template matches in an existing raw RGBA capture. */
  findAll: findAllNeedleInCapture,
};
