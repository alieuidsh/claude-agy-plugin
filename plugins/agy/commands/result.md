---
description: Retrieve the stored output of an agy (Antigravity/Gemini) job
argument-hint: "[job id, or blank for most recent]"
allowed-tools: Bash(node:*)
---

Show an agy job's result (the agy analogue of `/codex:result`).

The user may pass a job id. A valid id looks like `20260531_011528_4334`.

Steps:
1. If the user gave a job id, verify it matches `^\d{8}_\d{6}_\d{4}$` before using
   it. If it does NOT match, refuse and state the expected format — do not pass
   arbitrary text into the shell.
2. Run (substitute the validated id, or omit it for the most recent job):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" result <validated-id-or-empty>
```

Present the full command output to the user, attributed to agy / Gemini. Do not
summarize. If the job is still running, say so and suggest `/agy:status`.
