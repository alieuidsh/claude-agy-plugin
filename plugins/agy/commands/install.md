---
description: Install the agy (Antigravity/Gemini) CLI if it's missing, with your consent
argument-hint: ""
allowed-tools: Bash(node:*), AskUserQuestion
---

Detect whether the agy CLI is installed and, if not, offer to install it.

The check and the install are SEPARATE subcommands so a "check" can never trigger
a remote install by accident:
- `check-install` only reports state. It NEVER installs.
- `install --yes` actually runs the official installer. Without `--yes` it refuses
  and only prints what it would do.

Steps:
1. Check current state (safe — never installs):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" check-install
```

   - If it prints `INSTALLED: ...` → tell the user agy is ready; suggest `/agy:setup`
     to verify auth. STOP.
   - If it prints `NOT_INSTALLED` → continue to step 2.

2. Use `AskUserQuestion` ONCE to confirm. Explain plainly that this downloads and
   runs Google's official installer:
   "agy CLI 沒裝。要我幫你用官方安裝指令裝嗎？(Windows: `irm https://antigravity.google/cli/install.ps1 | iex`;
   macOS/Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`)"
   Options: "幫我裝" / "我自己裝".

3. ONLY if the user agrees, run the installer (note the required `--yes`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" install --yes
```
   If they decline, just show them the official command and stop.

4. After a successful install, tell the user:
   - Restart the terminal / Claude Code if `agy` isn't found yet.
   - Run `agy` once interactively to sign in with a Google account.
   - Then `/agy:setup` to confirm everything works.

NEVER run `install --yes` without the user's explicit agreement in step 2.
