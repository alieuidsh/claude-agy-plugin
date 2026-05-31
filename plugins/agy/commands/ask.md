---
description: Ask Google Antigravity (Gemini) a one-shot question and return its answer
argument-hint: "[--write] [your question]"
allowed-tools: Bash(node:*), Write
---

Ask agy (Gemini) a question; return its answer verbatim.

User's question:
$ARGUMENTS

Steps:
1. If empty, ask the user what to ask. Otherwise proceed.
2. **Injection-safe**: use `Write` to save the exact question to a UNIQUE temp file
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` (Windows `%TEMP%\agy_prompt_<unique>.txt`),
   never a fixed name. Pipe via stdin, then delete:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" ask < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (Windows: same with `%TEMP%\...` then `del "%TEMP%\agy_prompt_<unique>.txt"`.)
3. Return agy's answer (attribute to agy/Gemini; don't rewrite).
4. Non-zero exit → suggest `/agy:setup`. Don't loop-retry.

Permissions: read-only by default; append `--write` before the `<` to allow edits.
