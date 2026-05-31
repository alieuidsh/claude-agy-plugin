---
description: Delegate a task/fix to Google Antigravity (Gemini); agy may edit files
argument-hint: "[--read-only] [what agy should do]"
allowed-tools: Bash(node:*), Write
---

Delegate work to agy (Gemini). WRITE-capable: agy may edit files.

Raw request:
$ARGUMENTS

Steps:
1. If empty, ask what agy should do.
2. **Injection-safe**: `Write` the task to a UNIQUE temp file
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` (Windows `%TEMP%\...`). Never fixed name.
3. Run (pipe via stdin, then delete):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" rescue < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (Windows: `%TEMP%\...` then `del`.)
4. Review agy's edits with `git diff` before relying on them; commit first so you can revert.

Permissions: write-capable by default; append `--read-only` before the `<` for advice-only.
