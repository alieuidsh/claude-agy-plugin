---
description: Cancel running agy (Antigravity/Gemini) jobs
argument-hint: "[job id, or blank for all running]"
allowed-tools: Bash(node:*)
---

Cancel a running agy job. If a job id is given, verify it matches
`^\d{8}_\d{6}_\d{4}$` first (else refuse).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" cancel <validated-id-or-empty>
```

Kills only the targeted job's process tree (by stored PID). Present the confirmation.
