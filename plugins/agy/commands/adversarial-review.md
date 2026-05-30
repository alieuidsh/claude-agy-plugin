---
description: Run an adversarial Google Antigravity (Gemini) review that tries to break the local diff
argument-hint: "[--wait|--background] [focus]"
allowed-tools: Bash(node:*), Bash(git:*), Write, AskUserQuestion
---

Run an ADVERSARIAL agy (Antigravity / Gemini) review of the local git diff — agy
plays a ruthless reviewer hunting for bugs, security holes, and edge cases.
Review-only — agy runs WITHOUT write permissions for this command.

Raw arguments (may include --wait / --background and focus text):
$ARGUMENTS

Steps:
1. Strip `--wait` / `--background`; the rest is optional focus text.
2. **Injection-safe input**: if there is focus text, use the `Write` tool to save
   it to `${TMPDIR:-/tmp}/agy_prompt.txt` (Windows: `%TEMP%\agy_prompt.txt`) and
   pipe via stdin; otherwise pipe empty stdin. Never put focus text in the shell
   command string. The companion gathers the git diff itself.
3. Execution mode:
   - `--wait` / small diff → foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" adversarial-review < "$TMPDIR/agy_prompt.txt"
```
   - `--background` / large diff → same command with `Bash(..., run_in_background: true)`,
     then say: "agy adversarial review started. Check `/agy:status`."
4. Return agy's review verbatim. Do not fix the issues here.
