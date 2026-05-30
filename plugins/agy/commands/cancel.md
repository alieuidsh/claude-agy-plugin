---
description: Cancel running agy (Antigravity/Gemini) jobs
argument-hint: "[job id, or blank to cancel all running]"
allowed-tools: Bash(node:*)
---

Cancel a running agy job (the agy analogue of `/codex:cancel`).

The user may pass a job id. A valid id looks like `20260531_011528_4334`.

Steps:
1. If the user gave a job id, verify it matches `^\d{8}_\d{6}_\d{4}$` before using
   it. If it does NOT match, refuse and tell the user the expected format — do not
   pass arbitrary text into the shell.
2. Run (substitute the validated id, or omit it to cancel all running jobs):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" cancel <validated-id-or-empty>
```

The companion kills only the targeted job's process tree by stored PID (not all
agy processes) and marks matching job(s) cancelled. Present the confirmation.
