---
description: Ask Google Antigravity (Gemini) to research a question and return a synthesized answer
argument-hint: "[research question]"
allowed-tools: Bash(node:*), Write
---

Have agy (Antigravity / Gemini) research a question and return a synthesized answer.

Research question:
$ARGUMENTS

Steps:
1. If the question is empty, ask the user what to research. Otherwise proceed.
2. **Injection-safe input**: use the `Write` tool to save the question to a
   **uniquely-named** temp file (so concurrent runs never collide) — e.g.
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` (Windows: `%TEMP%\agy_prompt_<unique>.txt`),
   where `<unique>` is a random/timestamp token you pick this turn. Then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" research < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (On Windows cmd: `node "%CLAUDE_PLUGIN_ROOT%\scripts\agy-companion.mjs" research < "%TEMP%\agy_prompt_<unique>.txt"` then `del "%TEMP%\agy_prompt_<unique>.txt"`.)
   Never interpolate the question into the shell command string; never reuse a fixed filename.
3. Present agy's synthesized answer, attributed to agy / Gemini. Treat it as a
   second opinion and apply your own judgment.

Permissions: `research` runs READ-ONLY by default. If the user passed `--write`, add
it before the `<` redirect so the override reaches the companion.
