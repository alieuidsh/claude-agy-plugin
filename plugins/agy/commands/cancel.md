---
description: Cancel running agy (Antigravity/Gemini) jobs
argument-hint: "[job id, or blank to cancel all running]"
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" cancel "$ARGUMENTS"`

NOTE: agy shares one executable across jobs, so cancel kills ALL currently-running
agy processes, then marks the matching job(s) cancelled. Present the confirmation.
