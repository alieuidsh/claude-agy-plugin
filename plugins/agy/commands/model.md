---
description: Show or set the default Gemini/Claude model agy uses (persists across sessions)
argument-hint: "[alias or full label, e.g. flash | pro | \"Claude Opus 4.6 (Thinking)\"]"
allowed-tools: Bash(node:*)
---

Show or change the **default** model (the one used when a command omits `--model`).

User input (a model alias or full label, or empty to just show the current default):
$ARGUMENTS

Steps:
1. If `$ARGUMENTS` is empty → show the current default:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" model
```
2. Otherwise set it (saved to the plugin config — immediate, persists across sessions,
   no terminal restart). Pass the value as ONE argument; quote multi-word labels:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" model "<alias-or-label>"
```
   Examples: `model flash`, `model pro`, `model "Claude Opus 4.6 (Thinking)"`.

Notes:
- Aliases (`pro`/`flash` + tiers) are Gemini-only and track the live list. Claude/GPT-OSS
  need the full label — see `/agy:models` for the exact strings.
- Per-call `--model` always overrides this default for that one run.
- This is the single-model command; `/agy:models` (plural) lists ALL available models.
