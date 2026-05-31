---
description: Retrieve the stored output of an agy (Antigravity/Gemini) job
argument-hint: "[job id, or blank for most recent]"
allowed-tools: Bash(node:*)
---

Show an agy job's result. If the user gave a job id, verify it matches
`^\d{8}_\d{6}_\d{4}$` before using it (else refuse — don't pass arbitrary text).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" result <validated-id-or-empty>
```

Present output verbatim, attributed to agy/Gemini. If still running, say so + suggest `/agy:status`.
