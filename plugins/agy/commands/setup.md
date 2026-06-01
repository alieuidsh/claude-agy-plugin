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
- `RESULT: OK` → ready (the line also shows the model that answered). List commands:
  `/agy:ask /agy:rescue /agy:research /agy:review /agy:adversarial-review /agy:models
  /agy:setup /agy:install /agy:status /agy:result /agy:cancel`.
- `default model` / `settings model` lines show the companion's default (strongest Pro)
  vs your interactive default. Use `/agy:models` for the list and `--model` to pick one.
- `agy binary: NOT FOUND` → tell user to run `/agy:install` or set `AGY_BIN`.
- `node-pty: UNAVAILABLE` → auto-install failed; ensure Node.js + npm are on PATH and
  the network is reachable, then re-run `/agy:setup`. (node-pty installs itself on first
  run; you normally never see this.)
- auth error → run `agy` once interactively to sign in. Don't loop-retry.

Note: agy has no `--model` CLI flag, but the model IS selectable — the companion sets it
via `~/.gemini/antigravity-cli/settings.json` per call and restores it afterward. Default
is the strongest Pro; pass `--model <alias|label>` to change. See `/agy:models`.
