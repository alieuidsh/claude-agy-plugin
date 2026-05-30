---
name: agy
description: Delegate a coding task, second opinion, research, or deep investigation to Google Antigravity (the `agy` CLI, Gemini-backed) and return its answer — the agy counterpart to the codex plugin. TRIGGER when the user says "consult agy / Antigravity / Gemini", wants a second model's take on code, or asks agy to investigate/fix/research something. For explicit menu use, the slash commands /agy:ask /agy:rescue /agy:review /agy:adversarial-review /agy:research /agy:setup /agy:install /agy:status /agy:result /agy:cancel are also available.
---

# agy (Google Antigravity / Gemini) Runtime

Shell out to the locally-installed `agy` CLI to get a second opinion from Google
Antigravity (Gemini-backed), or to delegate write-capable work. This is the agy
equivalent of the `/codex` family. Backend model: whatever agy is configured to use
(commonly Gemini; set in `~/.gemini/antigravity-cli/settings.json`).

## How to invoke (always via the companion)

Use the cross-platform Node companion — never call `agy --print` by hand.

**Pass the user's prompt via STDIN, never on the shell command line** (injection-safe).
Write the prompt to a **uniquely-named** temp file with the `Write` tool — never a
fixed name, or concurrent runs collide — then pipe it in and delete it. Use a random
or timestamp token for `<unique>`:

```bash
# subcommand ∈ ask | task | research | review | adversarial-review
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" <subcommand> < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
(Windows: `node "%CLAUDE_PLUGIN_ROOT%\scripts\agy-companion.mjs" <subcommand> < "%TEMP%\agy_prompt_<unique>.txt"` then `del "%TEMP%\agy_prompt_<unique>.txt"`.)

For `setup` / `check-install` / `status` no stdin is needed. For `result` / `cancel`,
pass a job id that matches `^\d{8}_\d{6}_\d{4}$` (validate before use) — never arbitrary text:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" result <validated-id-or-empty>
```

## Permissions (per-command default; safe by design)

- `ask`, `research` — read-only by default; `--write` (before the `<` redirect) lets agy edit.
- `rescue` / `task` — write-capable by default; `--read-only` makes it advise without editing.
- **`review` and `adversarial-review` are ALWAYS read-only** — agy cannot edit during a
  review even if `--write` is passed (it is ignored). To act on review findings, use `/agy:rescue`.

Subcommands: `ask`, `task` (write-capable), `research`, `review` (read-only),
`adversarial-review` (read-only), `setup`, `check-install`, `install`, `status`, `result`, `cancel`.

## If the agy CLI is not installed

Check WITHOUT installing first (`check-install` never installs):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" check-install
```
If it prints `NOT_INSTALLED`, ask the user for consent, then install — the installer
runs ONLY with `--yes`:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" install --yes
```
(Official installer: Win `irm https://antigravity.google/cli/install.ps1 | iex`;
Unix `curl -fsSL https://antigravity.google/cli/install.sh | bash`.) Never run
`install --yes` without the user agreeing first.

## The companion handles agy's quirks for you — do not reimplement them

1. **`agy --print` writes its answer to the TTY, not stdout.** The companion reads
   the answer back from agy's on-disk transcript (`~/.gemini/antigravity-cli/brain`),
   correlated to THIS run by a per-job nonce.
2. **`--print` is a value-flag (alias of `--prompt`)** — it eats the next arg as the
   prompt. The companion puts boolean flags first and `--print <prompt>` last.
3. **Big prompts** (>8 KB, e.g. a large review diff) are auto-written to a temp file
   the companion tells agy to read, avoiding `spawn ENAMETOOLONG`.
4. **UTF-8** — answers are often Chinese; the companion emits clean UTF-8 to stdout.
5. **Format drift** — if agy's transcript format changes, the companion self-heals
   (heuristic, then a `AGY_NEEDS_CLAUDE_EXTRACTION` hand-off) instead of failing.

## Capabilities (verified)

- **Read + reason + advise + review + research** — reliable.
- **Autonomous file edits** — works for `task`/`rescue` (write-capable runs). Review
  commands never edit. Commit first (`git commit`) and check `git diff` afterward.
- Auth is silent via the OS keyring; there is normally no separate login step.

## If it stops working

- `setup` reports binary NOT FOUND → run `/agy:install`, or set `AGY_BIN`.
- Timeout / auth error → run `agy` once interactively to re-auth. Do NOT loop-retry.
- "transcript format not recognized" → `claude plugin update agy` (then restart).

## Using the result

Treat agy's output as a strong second opinion, not ground truth. Attribute to
agy / Gemini and apply your own judgment — same discipline as the codex flow.
