---
description: Have Google Antigravity (Gemini) review the local git diff as a second opinion
argument-hint: "[--wait|--background] [focus for the review]"
allowed-tools: Bash(node:*), Bash(git:*), Write, AskUserQuestion
---

Run an agy (Antigravity / Gemini) code review against the local git diff.
Review-only — agy runs WITHOUT write permissions for this command.

Raw arguments (may include --wait / --background and focus text):
$ARGUMENTS

Steps:
1. Strip `--wait` / `--background`; the rest is optional focus text.
2. **Injection-safe input**: if there is focus text, use the `Write` tool to save
   it to `${TMPDIR:-/tmp}/agy_prompt.txt` (Windows: `%TEMP%\agy_prompt.txt`) and
   pipe it in via stdin. If there is NO focus text, pipe an empty stdin. Never put
   focus text inside the shell command string. The companion gathers the git diff
   itself.
3. Execution mode:
   - `--wait` / small diff → foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" review < "$TMPDIR/agy_prompt.txt"
```
   - `--background` / large diff → same command with `Bash(..., run_in_background: true)`,
     then say: "agy review started. Check `/agy:status`." If unsure of size, use
     `AskUserQuestion` once (Wait vs Background).
4. Return agy's review verbatim. Do not fix the issues it raises in this command.
