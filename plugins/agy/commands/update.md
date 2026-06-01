---
description: Update the agy (Antigravity/Gemini) CLI to the latest version
argument-hint: ""
allowed-tools: Bash(node:*)
---

Update the local agy CLI (runs `agy update`). After updating, the cached model list is
cleared automatically so `/agy:models` re-scrapes the (possibly changed) model lineup.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" update
```

Report the before → after version. If the version changed, mention that `/agy:models`
will re-scrape on next run. If it failed (network/permission), suggest running
`agy update` directly in a terminal.
