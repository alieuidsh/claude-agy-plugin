# agy — Google Antigravity for Claude Code

*[繁體中文](README.zh-TW.md)*

Use the **agy CLI** (Google Antigravity) as a second model inside Claude Code — the
`agy` counterpart to the `codex` plugin. Ask questions, get second opinions, review your
diff, or delegate write-capable tasks, all without leaving Claude Code.

What makes it interesting: **agy can run Gemini, Claude, *and* GPT-OSS models** behind a
single CLI and account. This plugin surfaces that — pick any of them per call, or set a
default, straight from Claude Code.

> ⚠️ **Unofficial.** This is a community plugin, not affiliated with or endorsed by
> Google or Anthropic. "Antigravity", "Gemini", "Claude", and "Codex" belong to their
> respective owners.

---

## What you get

| Command | What it does |
|---|---|
| `/agy:ask` | Ask agy a one-shot question (read-only by default) |
| `/agy:research` | Ask agy to research and synthesize an answer |
| `/agy:rescue` | Delegate a task/fix — **agy may edit files** |
| `/agy:review` | agy reviews your local git diff (read-only) |
| `/agy:adversarial-review` | Ruthless adversarial review of your diff (read-only) |
| `/agy:model` | Show or set the **default** model |
| `/agy:models` | List **all** models your account can use (Gemini / Claude / GPT-OSS) |
| `/agy:update` | Update the agy CLI; refreshes the model list |
| `/agy:setup` | Health-check the integration |
| `/agy:install` | Install the agy CLI (asks first) |
| `/agy:status` `/agy:result` `/agy:cancel` | Manage background jobs |

---

## Requirements

- **Claude Code** (this is a plugin for it)
- **Node.js 18+** (the runtime is Node; `node-pty` is auto-installed on first run)
- The **agy CLI** (Google Antigravity). Don't have it? Run `/agy:install` (it asks
  first), or install manually from <https://antigravity.google>. After installing, run
  `agy` once interactively to sign in.

Tested on **Windows** and **Linux** (x86_64). macOS should work (same code paths) but is
untested. See *Platform notes* below for the Linux/SSH caveat.

---

## Install

> **Don't see the `/plugin` command?** Your Claude Code is too old — `/plugin` needs a
> recent version (2.1.143+). Update Claude Code first (Store app: update via Microsoft
> Store / App store; CLI: `claude update`), then restart it. Being able to use a new
> *model* like Opus 4.8 does **not** mean your app is up to date — models come from the
> server, the `/plugin` feature comes from the app.

**Step 1 — add the marketplace and install** (in Claude Code):

```bash
/plugin marketplace add alieuidsh/claude-agy-plugin
/plugin install agy@shuo-agy
```

**Step 2 — make the commands appear. ⚠️ This step is required, and it's where people get
stuck.** Newly installed commands do **not** show up until you reload or restart:

- Run **`/reload-plugins`**, **and**
- if the `/agy:*` commands still don't appear (or after a plugin *update*),
  **fully quit and reopen Claude Code** (close the window/app completely, not just the
  tab). A reload alone sometimes isn't enough for brand-new command files.

**Step 3 — health-check:**

```bash
/agy:setup     # verifies agy + node-pty + auth; auto-installs node-pty on first run
```

The very first `/agy:*` call takes ~15–20s (one-time node-pty install + first model-list
scrape). That's normal — it's cached after that, later calls are fast.

The first command that drives agy may take ~15–20s (one-time node-pty install + a model
list scrape, both cached afterward).

---

## How it works (and why)

agy 1.0.x **only produces output when it detects a real console (TTY)** — a plain
headless `spawn()` yields nothing. So this plugin drives agy inside a **synthesized
console (ConPTY) via `node-pty`**, reads its output, strips ANSI/BOM, and returns the
answer. `node-pty` ships prebuilt binaries for common Node/OS combos and is installed
automatically on first use (no C++ toolchain needed in the normal case).

The model list is scraped live from agy's interactive `/model` menu and cached, keyed on
the agy binary's fingerprint — it re-scrapes automatically when agy updates.

---

## Choosing a model

agy has **no `--model` CLI flag**, so this plugin selects a model by briefly and safely
rewriting `~/.gemini/antigravity-cli/settings.json`, then restoring it. This is done
under a lock and is **crash-safe** — your settings are never left corrupted, even if a
run is killed mid-flight (the original is persisted and recovered by the next run).

```bash
/agy:models                                  # see everything your account can run
/agy:model                                   # show the current default
/agy:model pro                               # set default to the strongest Gemini Pro
/agy:model flash                             # set default to Gemini Flash (fast, cheap)
/agy:model "Claude Opus 4.6 (Thinking)"      # default to a Claude model
/agy:ask --model flash  your question        # one-off override (doesn't change default)
```

- **Aliases** (`pro`, `flash`, plus `pro-low`, `flash-medium`, …) are **Gemini-only** and
  track the live list, so `pro`/`flash` follow the newest Gemini tier automatically.
- **Claude / GPT-OSS** models need the **full label** — copy it from `/agy:models`.
- The default is saved to `~/.agy-jobs/config.json` — instant, persists across sessions,
  no terminal restart. A per-call `--model` always wins over the default.
- Every run reports the model **actually used** (read from agy's own log, not the model's
  self-report — models are unreliable at naming themselves).

---

## Permissions

- `ask` / `research` are **read-only** by default; add `--write` to allow edits.
- `rescue` is **write-capable** by default; add `--read-only` for advice only.
- `review` / `adversarial-review` are **always read-only** — use `/agy:rescue` to act on
  findings.
- Read-only runs pass agy's `--sandbox` (terminal restrictions): agy can still read and
  analyze files, but system/terminal side-effects are blocked.

---

## Platform notes

- **Windows / Linux** — fully tested (model switching, scrape, crash-safe restore all work).
- **Linux + SSH gotcha**: agy stores its login in the desktop keyring when you sign in at
  a graphical session, but switches to file-based tokens when it detects an SSH session
  (`SSH_CONNECTION`). The two don't share state, so running the plugin **over a bare SSH
  connection** can hit "Authentication required" even though you're logged in on the
  desktop. Fixes: sign in *within* the SSH session, **or** run inside a `tmux`/`screen`
  session that was started from the desktop (no `SSH_CONNECTION` in its environment) —
  then agy reads the desktop login normally. This is an agy CLI behavior, not a plugin bug.

---

## ⚠️ Privacy — read this

agy sends your prompts (and, for `review`, your code diff) to **Google's servers**. Do
**not** use it on secrets, credentials, private keys, or confidential / unpublished work
you can't share with a third party. Treat it like any other cloud AI service.

---

## Troubleshooting

- **`/plugin` command not found** → your Claude Code is too old (below 2.1.143). Update
  the app and restart it (see [Install](#install)). Being able to use a new *model* does
  not mean the app is up to date.
- **Installed, but the `/agy:*` commands don't show up** → run **`/reload-plugins`**; if
  they still don't appear, **fully quit and reopen** Claude Code. New command files need a
  reload/restart to load.
- **`/agy:setup` says `agy binary: NOT FOUND`** → run `/agy:install`, or set the
  `AGY_BIN` environment variable to the agy executable's path.
- **`node-pty: UNAVAILABLE`** → the one-time auto-install failed; ensure Node.js + npm
  are on PATH and you have network, then re-run `/agy:setup`.
- **No answer / auth error** → run `agy` once interactively in a terminal to sign in.
- **Model list looks stale after an agy update** → `/agy:models --refresh` or `/agy:update`.

Don't loop-retry on failure — fix the underlying cause (auth, install, network).

---

## License

MIT. Unofficial; not affiliated with Google or Anthropic.
