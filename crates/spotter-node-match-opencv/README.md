# @spotter-rs/node-match-opencv

Independent native addon for OpenCV template matching. Does **not** depend on `@spotter-rs/node`.

## OpenCV install

### Windows (vcpkg)

```powershell
vcpkg install opencv4:x64-windows
# Set environment variables per https://github.com/twistedfall/opencv-rust
# e.g. OPENCV_LINK_LIBS, OPENCV_LINK_PATHS, OPENCV_INCLUDE_PATHS
```

### Linux (apt)

```bash
sudo apt install libopencv-dev clang libclang-dev
```

## Build

```bash
npm install
npm run build
```

## API

- `findTemplate(haystack, needlePath, needleBuffer?, opts?)`
- `findAllTemplates(haystack, needlePath, needleBuffer?, opts?)`
- `findTemplateBuffers(haystack, needle, opts?)`

`haystack` / `needle` images: `{ data: Buffer, width, height }` (RGBA).

Use with `@spotter/plugin-match-opencv` and `@spotter/core`.
