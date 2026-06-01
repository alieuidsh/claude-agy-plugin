---
description: List the Gemini models you can pass to agy's --model flag
argument-hint: ""
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" models`

Show the user the available models. Key points to convey:
- The **default** model (used when `--model` is omitted) — currently the strongest Pro.
- Any other command takes `--model <label-or-alias>`, e.g. `/agy:ask --model flash …`
  or `/agy:review --model "Gemini 3.1 Pro (High)" …`.
- You can pass ANY exact label, including a model newer than this list (it works as
  soon as the backend offers it). Unknown labels fall back to a Flash tier, and every
  run reports the model actually used.
