# @spotterjs/cli

Run spotterjs desktop automation, OCR, Android companion, and workspace commands
from a shell with JSON input and output. The package also includes an agent Skill.

This package replaces the retired `@spotterjs/mcp` package. Remove the old MCP
server entry from your agent configuration and install the CLI and bundled Skill.

```bash
npm install -g @spotterjs/cli
spotterjs list
spotterjs schema desktop_capture_screen
spotterjs run desktop_list_windows
spotterjs run desktop_capture_screen --json '{"detail":"original"}'
```

For a source checkout:

```bash
npm run build:ts
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js run desktop_list_windows
```

Use `--file args.json` or `--stdin` for Unicode, multiline text, or values that
are awkward to quote in a shell. Results use `{ "success": true, "data": ... }`
or `{ "success": false, "error": ... }`; failures exit nonzero.

```powershell
# Install into a skills parent directory; creates its spotterjs subdirectory.
spotterjs skill path
spotterjs skill install --target "$env:USERPROFILE\.codex\skills"
```

Enable optional capabilities with `SPOTTERJS_A11Y=1`, `SPOTTERJS_ANDROID=1`, or
`SPOTTERJS_RECORDING=1`. `list --all` discovers optional commands.
Host shell execution additionally requires `SPOTTERJS_ALLOW_SHELL=1`.

Use `spotterjs sequence --file plan.json` for a validated array of up to 100
`{ "name": "command_name", "arguments": {} }` steps. Android cached connections
and other process-local state last only for that invocation. Separate Android
actions must reconnect with `url` and `sessionToken`.

Full guides: [English](../../docs/en/CLI.md) / [中文](../../docs/zh-CN/CLI.md).
Bundled Skill: [SKILL.md](./skills/spotterjs/SKILL.md).
