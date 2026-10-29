# @spotterjs/plugin-ocr

## 1.1.0

### Patch Changes

- 7287ef5: Preserve image and text-crop aspect ratios during fixed-shape ONNX preprocessing.
  Pad detector images and normalized recognition tensors instead of stretching glyphs,
  restore shrunken DB text boxes before cropping, and translate detector output map sizes
  back to source coordinates while excluding detections entirely in padding. Reject
  malformed or multichannel probability-map outputs before postprocessing.
  Map preprocessed text geometry back to source pixels before applying crop/origin
  offsets, including search regions clipped at the source image edges.
- Updated dependencies [7287ef5]
- Updated dependencies [7287ef5]
  - @spotterjs/core@1.1.0

## 1.0.4

### Patch Changes

- Improve keyboard paste-mode shortcut dispatch, keep the `writeText` alias, and
  restore the clipboard after paste-mode writes settle.

### Patch Changes

- Updated dependencies [7254a3d]
- Updated dependencies
  - @spotterjs/core@1.0.4
  - @spotterjs/base@1.0.4

## 1.0.3

### Patch Changes

- Updated dependencies [5537232]
- Updated dependencies
  - @spotterjs/base@1.0.3
  - @spotterjs/core@1.0.3

## 1.0.1

### Patch Changes

- Updated dependencies
  - @spotterjs/base@1.0.1

## 1.0.0

### Minor Changes

- acfe3fa: Expose scored template match results, ship the ONNX OCR implementation, and add the Android ADB plugin package.

### Patch Changes

- Updated dependencies [acfe3fa]
  - @spotterjs/base@1.0.0
