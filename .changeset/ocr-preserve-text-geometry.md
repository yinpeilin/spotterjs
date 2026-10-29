---
"@spotterjs/plugin-ocr": patch
---

Preserve image and text-crop aspect ratios during fixed-shape ONNX preprocessing.
Pad detector images and normalized recognition tensors instead of stretching glyphs,
restore shrunken DB text boxes before cropping, and translate detector output map sizes
back to source coordinates while excluding detections entirely in padding. Reject
malformed or multichannel probability-map outputs before postprocessing.
Map preprocessed text geometry back to source pixels before applying crop/origin
offsets, including search regions clipped at the source image edges.
