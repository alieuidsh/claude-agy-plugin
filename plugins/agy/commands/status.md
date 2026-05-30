---
description: Show recent agy (Antigravity/Gemini) jobs and whether each is running or finished
argument-hint: ""
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" status`

Render the command output as a compact status list for the user: job id, kind,
status (running/done/failed/cancelled), and a snippet of the prompt.
