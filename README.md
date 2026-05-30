# claude-agy-plugin — Google Antigravity (Gemini) for Claude Code

**Languages:** **English** · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Italiano](README.it.md)

A Claude Code plugin that lets Claude call the local **`agy`** CLI (Google
Antigravity, Gemini-backed) to review code, delegate tasks, and give second
opinions — the **agy counterpart to the official `codex` plugin**.

Cross-platform: **Windows, Linux, macOS** (pure Node companion, no shell-specific wrappers).

## Commands

| Command | What it does | Default perms | codex analogue |
|---|---|---|---|
| `/agy:ask` | One-shot question to Gemini | read-only | — |
| `/agy:rescue` | Delegate a task/fix (agy may **edit files**) | **write** | `/codex:rescue` |
| `/agy:research` | Research-framed question | read-only | — |
| `/agy:review` | Review the local git diff | read-only | `/codex:review` |
| `/agy:adversarial-review` | Adversarial review of the diff | read-only | `/codex:adversarial-review` |
| `/agy:setup` | Health-check: installed + authed? | — | `/codex:setup` |
| `/agy:status` | List recent agy jobs | — | `/codex:status` |
| `/agy:result` | Show a job's stored output | — | `/codex:result` |
| `/agy:cancel` | Cancel running agy jobs | — | `/codex:cancel` |

You can also just say "consult agy / ask Gemini / get a second opinion" and the
bundled skill triggers automatically.

### Permissions: safe default, you choose

Like codex, each command has a **safe default** you can override:

- `--write` — allow agy to edit files (override a read-only default)
- `--read-only` — forbid edits, advice only (override a write default)

So `/agy:ask --write` lets agy edit, and `/agy:rescue --read-only` makes it advise
without touching files.

## Prerequisites

1. **Node.js** (v18+). Check: `node --version`.
2. **The `agy` CLI** (Google Antigravity), installed and signed in once.
   - **Don't have it?** Run **`/agy:install`** — the plugin detects it's missing and
     installs it for you (after asking). Or install manually:
     - Windows: `irm https://antigravity.google/cli/install.ps1 | iex`
     - macOS/Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
   - If installed elsewhere, set the `AGY_BIN` environment variable to its full path.
   - Auth is silent via the OS keyring; after install, run `agy` once interactively
     to sign in with a Google account.

Verify everything with `/agy:setup` after install.

## Install

```
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@suho-agy
```

Then restart Claude Code and run `/agy:setup`.

## Updating

This plugin self-distributes via GitHub, so everyone can pull the latest fixes:

```
/plugin update agy
```

Then restart Claude Code. (CLI equivalent: `claude plugin update agy`.) If a
command ever reports that agy's transcript format wasn't recognized, that means the
underlying `agy` CLI changed — run the update above to get the patched plugin.

## How it works

`scripts/agy-companion.mjs` runs `agy --print` with the correct flag order, waits
with a timeout, then extracts Gemini's answer from agy's on-disk transcript
(`agy --print` writes to the TTY, not stdout). Each run gets a per-job nonce so the
right transcript is read even when jobs run concurrently, and all answer segments
are joined (agy chunks long answers). The user's prompt is passed via **stdin**, so
no user text ever reaches the shell command line (no injection). Jobs are tracked
under `~/.agy-jobs` with their PID so `/agy:status`, `/agy:result`, and `/agy:cancel`
work across background runs and cancel only the targeted job.

## Security & privacy (please read)

- **Your code/prompts are sent to Google (Gemini).** Mind sensitive, medical, or
  unpublished data — same class of consideration as using any cloud model.
- **Write-capable commands edit files autonomously.** `/agy:rescue` may change files
  without asking. Commit first (`git commit`) so you can review/revert via `git diff`.
- agy is an autonomous agent: even in read-only mode it may run shell commands to
  explore. Read-only blocks file *edits*, not all activity.

## Notes / limitations

- agy shares one executable across jobs; `/agy:cancel` without an id kills all
  running jobs (with an id, only that job's process tree).
- Backend model is whatever agy is configured to use (default: Gemini), set in
  `~/.gemini/antigravity-cli/settings.json`.

## License

MIT — see [LICENSE](LICENSE).
