---
description: Delegate a task, investigation, or fix to Google Antigravity (Gemini); agy may edit files
argument-hint: "[--background|--wait] [--read-only] [what agy should do, investigate, or fix]"
allowed-tools: Bash(node:*), Write, AskUserQuestion
---

Delegate work to agy (Antigravity / Gemini). This is WRITE-capable: agy may edit
files in the current project to accomplish the task.

Raw request (may include --wait / --background):
$ARGUMENTS

Steps:
1. Strip any `--wait` / `--background` flag from the request; the remaining text
   is the task. If empty, ask the user what agy should do.
2. **Injection-safe input**: use the `Write` tool to save the task text to
   `${TMPDIR:-/tmp}/agy_prompt.txt` (Windows: `%TEMP%\agy_prompt.txt`). Never put
   the task text inside the shell command string.
3. Execution mode:
   - `--wait` (or small task) → foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" rescue < "$TMPDIR/agy_prompt.txt"
```
   - `--background` (or large multi-file task) → run that same command with
     `Bash(..., run_in_background: true)`, then tell the user: "agy task started.
     Check `/agy:status`." If neither flag is given and the task looks large, use
     `AskUserQuestion` once to offer Wait vs Background.
4. Return agy's output. Review its file changes before relying on them
   (`git diff`), since agy edits autonomously.

Permissions: `rescue` is WRITE-capable by default (agy may edit files). If the user
passes `--read-only`, append it to the node command to forbid edits (advice only).
Forward `--write` / `--read-only` to the companion verbatim.
