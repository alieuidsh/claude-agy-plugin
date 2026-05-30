# agy-antigravity — Google Antigravity (Gemini) for Claude Code

A Claude Code plugin that lets Claude call the local **`agy`** CLI (Google
Antigravity, Gemini-backed) to review code, delegate tasks, and give second
opinions — the **agy counterpart to the official `codex` plugin**.

Cross-platform: **Windows, Linux, macOS** (pure Node companion, no shell-specific
wrappers).

## Commands

| Command | What it does | codex analogue |
|---|---|---|
| `/agy:ask` | One-shot question to Gemini | — |
| `/agy:rescue` | Delegate a task/fix (agy may **edit files**) | `/codex:rescue` |
| `/agy:research` | Research-framed question | — |
| `/agy:review` | Review the local git diff (read-only) | `/codex:review` |
| `/agy:adversarial-review` | Adversarial review of the diff | `/codex:adversarial-review` |
| `/agy:setup` | Health-check: installed + authed? | `/codex:setup` |
| `/agy:status` | List recent agy jobs | `/codex:status` |
| `/agy:result` | Show a job's stored output | `/codex:result` |
| `/agy:cancel` | Cancel running agy jobs | `/codex:cancel` |

You can also just say "consult agy / ask Gemini / get a second opinion" and the
bundled skill triggers automatically.

## Prerequisites

1. **Node.js** (v18+). Check: `node --version`.
2. **The `agy` CLI** (Google Antigravity), installed and signed in once.
   - Windows default: `%LOCALAPPDATA%\agy\bin\agy.exe`
   - Linux/macOS: `~/.agy/bin/agy` or on `PATH`
   - If installed elsewhere, set the `AGY_BIN` environment variable to its full path.
   - Auth is silent via the OS keyring; if calls time out, run `agy` once
     interactively to sign in.

Verify everything with `/agy:setup` after install.

## Install (other machines)

```
/plugin marketplace add <your-github-user>/agy-antigravity
/plugin install agy@agy-antigravity
```

Then restart Claude Code and run `/agy:setup`.

## How it works

`scripts/agy-companion.mjs` runs `agy --print` with the correct flag order, waits
with a timeout, then extracts Gemini's answer from agy's on-disk transcript
(`agy --print` writes to the TTY, not stdout). Jobs are tracked under `~/.agy-jobs`
so `/agy:status`, `/agy:result`, and `/agy:cancel` work across background runs.

## Notes / limitations

- agy shares one executable across jobs, so `/agy:cancel` kills **all** running agy
  processes (then labels the matching job cancelled).
- Backend model is whatever agy is configured to use (default: Gemini 3.5 Flash High),
  set in `~/.gemini/antigravity-cli/settings.json`.

## License

MIT — see [LICENSE](LICENSE).
