---
description: List the Gemini models you can pass to agy's --model flag
argument-hint: ""
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" models`

This lists ALL models the account can use (Gemini + Claude + GPT-OSS), scraped live from
agy's `/model` menu and cached (re-scraped when agy updates or after 7 days; `--refresh`
forces it). Key points to convey:
- The **default** model (used when `--model` is omitted): the `[built-in]` /
  `[set via /agy:model]` tag shows where it comes from.
- **Change the default**: `/agy:model <alias|label>` (e.g. `/agy:model flash`) — saved to
  the plugin config, takes effect immediately, persists across sessions, no restart.
  `/agy:model` with no argument shows the current default. (`/agy:model` = the single
  current model; `/agy:models` = this full list.)
- **Per-call** override: any command takes `--model <alias|label>`, e.g.
  `/agy:ask --model flash …` or `/agy:ask --model "Claude Opus 4.6 (Thinking)" …`.
  Aliases (`pro`/`flash` + tiers) are Gemini-only; Claude/GPT-OSS need the full label.
- You can pass ANY exact label, including a model newer than the list (works as soon as
  the backend offers it). Unknown labels fall back to a Flash tier; every run reports the
  model actually used.
- If the list looks stale after an agy update, run `/agy:models --refresh` or `/agy:update`.
