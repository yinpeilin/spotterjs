# Launch notes

Copy for the public GitHub launch. Do not invent download or star counts.

## GitHub About

Set this in the repository About panel (the gear next to About on the repo page).

Description:

```text
TypeScript desktop automation with a Rust core: screenshot, click, template match, accessibility, and MCP.
```

Topics:

```text
desktop-automation
rpa
typescript
rust
mcp
screenshot
template-matching
accessibility
computer-use
nodejs
```

`gh repo edit` currently returns HTTP 403 on the token used for this launch PR. The token does not have Administration on yinpeilin/spotterjs, so the owner should set the description and topics in the GitHub UI.

If you have a token with Administration, this is the intended command:

```bash
gh repo edit yinpeilin/spotterjs --description "TypeScript desktop automation with a Rust core: screenshot, click, template match, accessibility, and MCP." --add-topic desktop-automation --add-topic rpa --add-topic typescript --add-topic rust --add-topic mcp --add-topic screenshot --add-topic template-matching --add-topic accessibility --add-topic computer-use --add-topic nodejs
```

## Show HN

Title:

```text
Show HN: spotterjs – TypeScript desktop automation with Rust and MCP
```

Body:

I built spotterjs because most of the desktop apps I need to automate have no usable API. The public surface is TypeScript: capture the screen, find a control with template matching or the accessibility tree, and click it. Screenshot, input, windows, accessibility, and NCC matching run in a Rust native addon. There is also an MCP server so coding agents can use the same tools.

Prebuilt packages are on npm for Windows x64 (MSVC) and Linux x64 (glibc). macOS is not published yet. The project is MIT-licensed, so you can use it in products, SaaS, and internal tools.

## Reddit

Title variant:

```text
spotterjs: TypeScript desktop automation with a Rust core and MCP
```

Use the same two-paragraph body as Show HN. Do not add download, star, or benchmark numbers that are not in the repo.
