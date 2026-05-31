---
name: agy
description: Delegate a coding task, second opinion, research, or deep investigation to Google Antigravity (the `agy` CLI, Gemini-backed) and return its answer — the agy counterpart to the codex plugin. TRIGGER when the user says "consult agy / Antigravity / Gemini", wants a second model's take on code, or asks agy to investigate/fix/research something. Slash commands: /agy:ask /agy:rescue /agy:review /agy:adversarial-review /agy:research /agy:setup /agy:install /agy:status /agy:result /agy:cancel.
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

## If it stops working

- node-pty installs itself on first run (one-time `npm install` into the plugin dir).
  If `setup` shows `node-pty: UNAVAILABLE`, the auto-install failed — ensure Node.js +
  npm are on PATH and the network is reachable, then re-run `/agy:setup`.
- `agy binary: NOT FOUND` → `/agy:install`, or set `AGY_BIN`.
- no answer / auth error → run `agy` once interactively to sign in. Don't loop-retry.

## Using the result

Treat agy's output as a strong second opinion, not ground truth. Attribute to
agy/Gemini; apply your own judgment — same discipline as the codex flow.
