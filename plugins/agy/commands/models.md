---
description: List the Gemini models you can pass to agy's --model flag
argument-hint: ""
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" models`

Show the user the available models. Key points to convey:
- The **default** model (used when `--model` is omitted) — built-in is the strongest Pro;
  the output's `[built-in]` / `[from env …]` tag shows where the default comes from.
- **Change the default permanently** (no file edits, survives plugin updates): set the
  env var `AGY_DEFAULT_MODEL` to a label or alias, e.g. `AGY_DEFAULT_MODEL=flash`, or
  `AGY_DEFAULT_MODEL="Gemini 3.5 Pro (High)"` once it ships. On Windows persist it with
  `setx AGY_DEFAULT_MODEL flash` (new terminals only). Per-call `--model` always wins.
- Any command takes `--model <label-or-alias>`, e.g. `/agy:ask --model flash …` or
  `/agy:review --model "Gemini 3.1 Pro (High)" …`.
- You can pass ANY exact label, including a model newer than this list (it works as
  soon as the backend offers it). Unknown labels fall back to a Flash tier, and every
  run reports the model actually used.
