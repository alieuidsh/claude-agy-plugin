---
description: Install the agy (Antigravity/Gemini) CLI if it's missing, with your consent
argument-hint: ""
allowed-tools: Bash(node:*), AskUserQuestion
---

Detect whether the agy CLI is installed and, if not, offer to install it.

Steps:
1. Check current state:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" install
```

   - If it prints "agy is already installed at: ..." → tell the user it's ready;
     suggest `/agy:setup` to verify auth. STOP.
   - If agy is NOT installed, the command above WILL run the official installer.
     So do NOT run it blindly — instead, FIRST confirm with the user (next step).

2. Before installing, use `AskUserQuestion` ONCE to confirm. Explain plainly:
   "agy CLI 沒裝。要我幫你用官方安裝指令裝嗎？(Windows: `irm https://antigravity.google/cli/install.ps1 | iex`;
   macOS/Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`)"
   Options: "幫我裝" / "我自己裝".

3. If the user agrees, run the install command from step 1 (it runs the official
   installer for their OS and verifies). If they decline, just show them the
   official command and stop.

4. After a successful install, tell the user:
   - Restart the terminal / Claude Code if `agy` isn't found yet.
   - Run `agy` once interactively to sign in with a Google account.
   - Then `/agy:setup` to confirm everything works.

NEVER install without the user's explicit agreement in step 2.
