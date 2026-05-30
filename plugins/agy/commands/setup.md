---
description: Check whether the local agy (Antigravity/Gemini) CLI is installed and authenticated
argument-hint: ""
allowed-tools: Bash(node:*)
---

Health-check the agy integration (the agy analogue of `/codex:setup`).

Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" setup
```

Report to the user:
- If it prints `✅ agy is ready` → list the commands: `/agy:ask`, `/agy:rescue`,
  `/agy:research`, `/agy:review`, `/agy:adversarial-review`, `/agy:status`,
  `/agy:result`, `/agy:cancel`.
- If the binary is NOT FOUND → tell the user to install the Antigravity CLI (`agy`)
  or set the `AGY_BIN` env var to its path.
- If it errors on auth → tell the user to run `agy` once interactively to sign in
  (silent keyring auth). Do NOT loop-retry.
