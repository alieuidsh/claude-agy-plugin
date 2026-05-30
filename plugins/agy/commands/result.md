---
description: Retrieve the stored output of an agy (Antigravity/Gemini) job
argument-hint: "[job id, or blank for most recent]"
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" result "$ARGUMENTS"`

Present the full command output to the user, attributed to agy / Gemini. Do not
summarize. If the job is still running, say so and suggest `/agy:status`.
