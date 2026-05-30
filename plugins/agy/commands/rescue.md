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
2. **Injection-safe input**: use the `Write` tool to save the task text to a
   **uniquely-named** temp file (so concurrent runs never collide) — e.g.
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` (Windows: `%TEMP%\agy_prompt_<unique>.txt`),
   where `<unique>` is a random/timestamp token you pick this turn. Never put the
   task text inside the shell command string, and never reuse a fixed filename.
3. Execution mode (pipe the exact file via stdin, then delete it):
   - `--wait` (or small task) → foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" rescue < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (On Windows cmd: `node "%CLAUDE_PLUGIN_ROOT%\scripts\agy-companion.mjs" rescue < "%TEMP%\agy_prompt_<unique>.txt"` then `del "%TEMP%\agy_prompt_<unique>.txt"`.)
   - `--background` (or large multi-file task) → run that same command with
     `Bash(..., run_in_background: true)`, then tell the user: "agy task started.
     Check `/agy:status`."
4. Return agy's output. Review its file changes before relying on them
   (`git diff`), since agy edits autonomously. Commit first so you can revert.

Permissions: `rescue` is WRITE-capable by default (agy may edit files). If the user
passed `--read-only`, add it before the `<` redirect, e.g.
`node "...agy-companion.mjs" rescue --read-only < "$TMPDIR/agy_prompt_<unique>.txt"`,
to forbid edits (advice only).
