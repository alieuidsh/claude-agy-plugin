---
description: Install the agy (Antigravity/Gemini) CLI if missing, with your consent
argument-hint: ""
allowed-tools: Bash(node:*), AskUserQuestion
---

Detect agy; if missing, install it after consent. `check-install` NEVER installs;
`install --yes` actually runs the official installer.

Steps:
1. Check (safe):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" check-install
```
   - `INSTALLED: ...` → ready; suggest `/agy:setup`. STOP.
   - `NOT_INSTALLED` → step 2.
2. `AskUserQuestion` once to confirm (explain it downloads + runs Google's official
   installer: Win `irm https://antigravity.google/cli/install.ps1 | iex`; Unix
   `curl -fsSL https://antigravity.google/cli/install.sh | bash`).
3. Only if agreed:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" install --yes
```
4. After install: restart if needed, run `agy` once to sign in, then `/agy:setup`.

NEVER run `install --yes` without explicit consent.
