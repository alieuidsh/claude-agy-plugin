---
description: Check whether agy (Antigravity/Gemini) is installed, node-pty is present, and agy is authed
argument-hint: ""
allowed-tools: Bash(node:*)
---

Health-check the agy integration.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" setup
```

Report:
- `RESULT: OK` → ready. List commands: `/agy:ask /agy:rescue /agy:research /agy:review
  /agy:adversarial-review /agy:setup /agy:install /agy:status /agy:result /agy:cancel`.
- `agy binary: NOT FOUND` → tell user to run `/agy:install` or set `AGY_BIN`.
- `node-pty: MISSING` → run `npm install` in the plugin dir (v2 needs node-pty to
  synthesize a console; agy outputs nothing without one).
- auth error → run `agy` once interactively to sign in. Don't loop-retry.
