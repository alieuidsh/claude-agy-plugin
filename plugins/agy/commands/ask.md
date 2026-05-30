---
description: Ask Google Antigravity (Gemini) a one-shot question and return its answer
argument-hint: "[--write] [your question for Gemini]"
allowed-tools: Bash(node:*), Write
---

Ask agy (Antigravity / Gemini) a question and return its answer verbatim.

The user's question:
$ARGUMENTS

Steps:
1. If the question above is empty, ask the user what they want to ask agy. Otherwise proceed.
2. **Injection-safe input**: do NOT put the user's text inside the shell command.
   Instead, use the `Write` tool to save the exact question to a temp file
   `${TMPDIR:-/tmp}/agy_prompt.txt` (on Windows use `%TEMP%\agy_prompt.txt`),
   then pipe that file into the companion via stdin:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" ask < "$TMPDIR/agy_prompt.txt"
```
   (On Windows: `node "%CLAUDE_PLUGIN_ROOT%\scripts\agy-companion.mjs" ask < "%TEMP%\agy_prompt.txt"`.)

   The companion reads the prompt from stdin, so no user text ever touches the
   shell command line. Never interpolate the raw question into the `node` string.
3. Return agy's answer to the user. You MAY add a one-line attribution like
   "— agy / Gemini" but do not rewrite agy's content.
4. If the command exits non-zero (timeout/auth), tell the user to run `/agy:setup`
   to diagnose. Do NOT loop-retry.

Permissions: `ask` runs READ-ONLY by default (agy cannot edit your files). If the
user passed `--write`, add it before the `<` redirect, e.g.
`node "...agy-companion.mjs" ask --write < "$TMPDIR/agy_prompt.txt"`.
(Default safe; user can opt in — same model as codex.)
