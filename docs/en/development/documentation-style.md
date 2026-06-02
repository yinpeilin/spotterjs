# Documentation Style

[中文文档](../../zh-CN/development/documentation-style.md)

spotterjs documentation is bilingual. English is the default language for
GitHub, npm, package READMEs, public API comments, and generated declarations.
Chinese is maintained as a parallel localized documentation tree.

## Information Architecture

| Location | Responsibility |
|----------|----------------|
| Root `README.md` | English project overview, install, quick start, package matrix, docs map, license |
| Root `README.zh-CN.md` | Chinese project overview |
| `docs/en` | Canonical English documentation |
| `docs/zh-CN` | Chinese documentation mirror |
| Package README | npm-facing English entrypoint with links to both language docs |
| `docs/*` compatibility pages | Legacy links that point readers to English and Chinese docs |
| `docs/en/development` / `docs/zh-CN/development` | Maintainer docs |
| `docs/*/troubleshooting.md` | Cross-module troubleshooting |

Long explanations belong in `docs/en` and `docs/zh-CN`. Package READMEs should
remain short enough for npm users to decide whether to install and how to start.

## API Comments

Public TSDoc/JSDoc must be English because it appears in `.d.ts`, IDE hover
text, and code-agent context. Prefer this order:

1. What the API does.
2. Input shape and coordinate space.
3. Defaults and side effects.
4. Return value.
5. Throws or failure behavior.
6. A short example when it materially helps.

Do not document internal helpers as public promises. Use `@internal` for helper
APIs that are exported only for local composition.

## English Writing

- Use direct, concrete sentences.
- Keep examples runnable.
- Use `TypeScript`, `Rust`, `Node.js`, `MCP`, `N-API`, `ADB`, `ONNX Runtime`,
  and other standard technical names in English.
- Use backticks for packages, commands, paths, environment variables, and APIs.
- Prefer explicit coordinate labels such as "screen coordinates" or
  "`android-device` coordinates".

## Chinese Writing

- Keep Chinese docs natural and concise.
- Add spaces between Chinese and English/API terms.
- Use full-width punctuation in Chinese prose.
- Keep package names, API names, commands, protocols, and formats in English.

## Examples

- Code blocks must include a language tag: `typescript`, `bash`,
  `powershell`, `json`, or `text`.
- Examples that control real desktops, devices, or applications must state the
  risk in the surrounding text.
- Prefer PowerShell examples for Windows-specific environment variables.

## Links

- Link within the same language tree when possible.
- Each English page should link to the corresponding Chinese page, and each
  Chinese page should link back to English.
- Package README files should link to English docs by default and expose a
  visible Chinese docs link.
- Run `npm run docs:check` after moving, adding, or editing Markdown files.
  The check rejects invalid UTF-8 and validates local Markdown links.

## Update Checklist

- [ ] New user-facing behavior appears in the relevant English guide.
- [ ] The matching Chinese page is updated.
- [ ] Public API comments are English and mention coordinate spaces where relevant.
- [ ] MCP tool changes are reflected in `docs/en/MCP.md` and `docs/zh-CN/MCP.md`.
- [ ] Package README links still point to valid files.
- [ ] Markdown files are valid UTF-8 and contain no replacement characters.
- [ ] `npm run docs:check` passes.
