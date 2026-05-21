# @spotter/core



TypeScript API for Spotter desktop automation, workspace host I/O, and shell helpers.



## Modules



| Export | Description |

|--------|-------------|

| `screen` | Capture + NCC template match (`find`, `findAll`, `waitFor`, path or Buffer) |

| `findInWindow`, `findAllInWindow`, `tapInWindow` | Template match inside a window |

| `mouse`, `keyboard`, `windowApi` | Desktop automation (native) |

| `desktop` | Apps/windows by process (`listApps`, `waitForWindow`, …) |

| `accessibility` | UIA / AT-SPI + `tapElement`, `typeInto`, `findAndInvoke` |

| `host` | Sandboxed `readFile`, `writeFile`, `exec` (PowerShell on Windows, bash on Linux) |

| `encodePng` / `captureToBase64` | PNG encoding for captures |
| `loadNative()` | Advanced escape hatch — buffer match, scripts; types from `@spotter-rs/node` |



Template matching details: [docs/MATCHING.md](../../docs/MATCHING.md).

### When to use `loadNative()`

Use the high-level modules above for normal automation. Call `loadNative()` when you need **in-memory** haystack/needle (`findTemplateBuffers`), direct window capture, or integration scripts that bypass the wrappers. Types are `SpotterNative` (re-exported from auto-generated `@spotter-rs/node` bindings).



MCP server: [`@spotter/mcp`](../mcp) — see [docs/MCP.md](../../docs/MCP.md).



Requires `@spotter-rs/node` native addon (prebuilt for Windows x64 and Linux x64-gnu).



```bash

npm install @spotter/core

```



## License



Learning and non-commercial use are free. Commercial use: `ypl123698745@qq.com` or [Gitee Issues](https://gitee.com/ypl0lpy/spotter/issues). See [LICENSE](../../LICENSE).

