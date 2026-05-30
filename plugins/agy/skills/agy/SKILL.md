---
name: agy
description: Delegate a coding task, second opinion, research, or deep investigation to Google Antigravity (the `agy` CLI, Gemini-backed) and return its answer — the agy counterpart to the codex plugin. TRIGGER when the user says "consult agy / Antigravity / Gemini", wants a second model's take on code, or asks agy to investigate/fix/research something. For explicit menu use, the slash commands /agy:ask /agy:rescue /agy:review /agy:adversarial-review /agy:research /agy:setup /agy:status /agy:result /agy:cancel are also available.
---

# agy (Google Antigravity / Gemini) Runtime

Shell out to the locally-installed `agy` CLI to get a second opinion from Google
Antigravity (Gemini-backed), or to delegate write-capable work. This is the agy
equivalent of the `/codex` family. Backend model: Gemini 3.5 Flash (High).

## How to invoke (always via the companion)

Use the cross-platform Node companion — never call `agy --print` by hand.

**Pass the user's prompt via STDIN, never on the shell command line** (injection-safe).
Write the prompt to a temp file with the `Write` tool, then pipe it in:

```bash
# subcommand ∈ ask | task | research | review | adversarial-review
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" <subcommand> < "$TMPDIR/agy_prompt.txt"
```
(Windows: `node "%CLAUDE_PLUGIN_ROOT%\scripts\agy-companion.mjs" <subcommand> < "%TEMP%\agy_prompt.txt"`.)

For `setup` / `status` no stdin is needed. For `result` / `cancel`, pass a job id that
matches `^\d{8}_\d{6}_\d{4}$` (validate before use) — never arbitrary text:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" result <validated-id-or-empty>
```

Permission override (optional, mirrors codex): append `--write` or `--read-only`
to the node command before the `<` redirect to override the subcommand's default.

Subcommands: `ask`, `task` (write-capable), `research`, `review`,
`adversarial-review`, `setup`, `install`, `status`, `result`, `cancel`.

If the agy CLI is not installed, any command will say so and point to `/agy:install`,
which runs the official installer (Win: `irm https://antigravity.google/cli/install.ps1 | iex`;
Unix: `curl -fsSL https://antigravity.google/cli/install.sh | bash`) after asking the user.

The companion handles three agy quirks for you, so do not reimplement them:
1. **`agy --print` writes its answer to the TTY, not stdout.** The companion reads
   the answer back from agy's on-disk transcript (`~/.gemini/antigravity-cli/brain`).
2. **`--print` is a value-flag (alias of `--prompt`)** — it eats the next arg as the
   prompt. The companion always puts boolean flags first and `--print <prompt>` last.
3. **UTF-8** — answers are often Chinese; the companion emits clean UTF-8 to stdout.

## Capabilities (all verified)

- **Read + reason + advise + research** — reliable.
- **Autonomous file edits** — WORKS. With the correct arg order, agy writes to its
  scratch workspace and to `--add-dir` project dirs. `task`/`rescue` use this.
- Auth is silent via the OS keyring; there is normally no separate login step.

## If it stops working

- `setup` reports binary NOT FOUND → install the Antigravity CLI, or set `AGY_BIN`.
- Timeout / auth error → run `agy` once interactively to re-auth. Do NOT loop-retry.

## Using the result

Treat agy's output as a strong second opinion, not ground truth. Attribute to
agy / Gemini and apply your own judgment — same discipline as the codex flow.
