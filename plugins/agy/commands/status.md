---
description: Show recent agy (Antigravity/Gemini) jobs and their status
argument-hint: ""
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" status`

Render as a compact list: job id, kind, status, prompt snippet.
