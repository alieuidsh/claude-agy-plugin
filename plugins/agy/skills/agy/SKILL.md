---
name: agy
description: Delegate a coding task, second opinion, research, or deep investigation to Google Antigravity (the `agy` CLI — can run Gemini, Claude, or GPT-OSS) and return its answer — the agy counterpart to the codex plugin. TRIGGER when the user says "consult agy / Antigravity / Gemini", wants a second model's take on code, or asks agy to investigate/fix/research something. Slash commands: /agy:ask /agy:rescue /agy:review /agy:adversarial-review /agy:research /agy:model /agy:models /agy:update /agy:setup /agy:install /agy:status /agy:result /agy:cancel.
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

agy can run **Gemini, Claude, and GPT-OSS** models (verified by scraping its `/model`
menu). agy has no `--model` CLI flag, so the companion picks a model by briefly rewriting
`~/.gemini/antigravity-cli/settings.json`'s `model` field, running, then restoring it
(serialized by a lock; the user's value is always restored, even on error/timeout). The
model that actually answered is read back from cli.log and reported on stderr — relay it.

Three model commands:
- **`/agy:models`** (plural) — lists ALL models the account can use, scraped live from the
  `/model` menu and cached (re-scraped when agy updates, after 7 days, or with `--refresh`).
- **`/agy:model`** (singular) — shows the current default; `/agy:model <name>` sets it.
  Saved to the plugin config (`~/.agy-jobs/config.json`): immediate, persists across
  sessions, no restart. This is the right answer when a user says "always use X" or
  "change the default model" — do NOT tell them to edit the script or set env vars.
- **`--model <name>`** on any run command (ask/research/rescue/review/adversarial) —
  one-off override; always wins over the default.

Names:
- Aliases are **Gemini-only**: `pro`/`pro-high` → newest Gemini Pro (High), `flash` →
  newest Gemini Flash (High), plus `pro-low`, `flash-medium`, `flash-low`. They resolve
  against the live list, so when a newer Gemini ships, `pro`/`flash` track it.
- Claude / GPT-OSS need the **full label**, e.g. `"Claude Opus 4.6 (Thinking)"`,
  `"GPT-OSS 120B (Medium)"` — get exact strings from `/agy:models`.
- Any exact label passes through, including one newer than the cached list. Unknown
  labels fall back to a Flash tier; the reported actual-model tells you what ran.
- Default when nothing is set: `Gemini 3.1 Pro (High)` (strongest Pro now).
- (NOTE: a model's *self-report* of its own name is unreliable — trust the cli.log line /
  the companion's reported model, not what the model says it is.)

## If it stops working

- node-pty installs itself on first run (one-time `npm install` into the plugin dir).
  If `setup` shows `node-pty: UNAVAILABLE`, the auto-install failed — ensure Node.js +
  npm are on PATH and the network is reachable, then re-run `/agy:setup`.
- `agy binary: NOT FOUND` → `/agy:install`, or set `AGY_BIN`.
- no answer / auth error → run `agy` once interactively to sign in. Don't loop-retry.

## Using the result

Treat agy's output as a strong second opinion, not ground truth. Attribute to
agy/Gemini; apply your own judgment — same discipline as the codex flow.
