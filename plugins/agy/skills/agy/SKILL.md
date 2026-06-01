---
name: agy
description: Delegate a coding task, second opinion, research, or deep investigation to Google Antigravity (the `agy` CLI, Gemini-backed) and return its answer — the agy counterpart to the codex plugin. TRIGGER when the user says "consult agy / Antigravity / Gemini", wants a second model's take on code, or asks agy to investigate/fix/research something. Slash commands: /agy:ask /agy:rescue /agy:review /agy:adversarial-review /agy:research /agy:models /agy:setup /agy:install /agy:status /agy:result /agy:cancel.
---

# agy (Google Antigravity / Gemini) Runtime — v2

Shell out to the local `agy` CLI for a second opinion from Gemini, or to delegate
write-capable work. The agy analogue of the `/codex` family.

## How v2 works (important)

agy outputs NOTHING unless it detects a real console. v2 runs agy inside a
**synthesized console (node-pty / ConPTY)**, reads stdout, strips ANSI/BOM, and
returns the answer. (v1 tried to read agy's transcript file — that path is empty in
headless mode and was abandoned. Do NOT reintroduce it.)

## Invoke via the companion (prompt through stdin, never the shell line)

Use `Write` to save the prompt to a UNIQUE temp file, pipe via stdin, then delete:

```bash
# subcommand ∈ ask | task | research | review | adversarial-review
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" <subcommand> < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
(Windows: `%TEMP%\agy_prompt_<unique>.txt` then `del`.) Never a fixed filename
(concurrent runs collide). `setup`/`check-install`/`status` need no stdin;
`result`/`cancel` take a job id matching `^\d{8}_\d{6}_\d{4}$` (validate first).

Subcommands: ask, task (write), research, review (read-only), adversarial-review
(read-only), setup, check-install, install, status, result, cancel.

## Permissions

- ask/research read-only by default; `--write` allows edits.
- rescue/task write-capable by default; `--read-only` for advice-only.
- review/adversarial-review ALWAYS read-only (use rescue to act on findings).
- Read-only runs add agy's `--sandbox` (terminal restrictions): agy can still read and
  analyze files, but system/terminal side-effects are blocked. Write runs use
  `--dangerously-skip-permissions` (no interactive approval is possible in print mode).

## Model selection

Every command takes `--model <alias|label>`. Default is the strongest Pro
(`Gemini 3.1 Pro (High)`), overridable via env `AGY_DEFAULT_MODEL` (see below). agy has
no `--model` CLI flag, so the companion sets the model by briefly rewriting
`~/.gemini/antigravity-cli/settings.json`'s `model` field, running, then restoring it
(serialized by a lock; the user's value is always restored, even on error/timeout —
verified). The model that actually answered is read back from cli.log and reported on
stderr — relay it.

- **Default override**: env `AGY_DEFAULT_MODEL` (alias or label) changes the default
  with no file edits and survives plugin updates; per-call `--model` still wins. If a
  user asks to "always use X" or "change the default model", point them to this env var
  (`setx AGY_DEFAULT_MODEL …` on Windows) rather than editing the script.
- Aliases: `pro` / `pro-high` → Gemini 3.1 Pro (High); `flash` → Gemini 3.5 Flash (High);
  also `pro-medium`, `pro-low`, `flash-medium`, `flash-low`, and `3.1-pro` etc.
- You may pass ANY exact label, including a model newer than the built-in list (e.g. a
  future `"Gemini 3.5 Pro (High)"`) — it works as soon as the backend offers it.
- Unknown labels safely fall back to a Flash tier; the reported actual-model tells you.
- `/agy:models` lists the known aliases + your current default.
- Verified: setting `Gemini 3.1 Pro (High)` → backend receives exactly that (cli.log
  `Propagating selected model ... label="Gemini 3.1 Pro (High)"`); a nonexistent label
  falls back. (NOTE: a model's *self-report* of its own name is unreliable — trust the
  cli.log line / the companion's reported model, not what the model says it is.)

## If it stops working

- node-pty installs itself on first run (one-time `npm install` into the plugin dir).
  If `setup` shows `node-pty: UNAVAILABLE`, the auto-install failed — ensure Node.js +
  npm are on PATH and the network is reachable, then re-run `/agy:setup`.
- `agy binary: NOT FOUND` → `/agy:install`, or set `AGY_BIN`.
- no answer / auth error → run `agy` once interactively to sign in. Don't loop-retry.

## Using the result

Treat agy's output as a strong second opinion, not ground truth. Attribute to
agy/Gemini; apply your own judgment — same discipline as the codex flow.
