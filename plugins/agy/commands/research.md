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
2. **Injection-safe input**: use the `Write` tool to save the question to
   `${TMPDIR:-/tmp}/agy_prompt.txt` (Windows: `%TEMP%\agy_prompt.txt`), then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" research < "$TMPDIR/agy_prompt.txt"
```
   Never interpolate the question into the shell command string.
3. Present agy's synthesized answer, attributed to agy / Gemini. Treat it as a
   second opinion and apply your own judgment.

Permissions: `research` runs READ-ONLY by default. If the user passed `--write`,
add it BEFORE the `<` redirect so the override reaches the companion, e.g.
`node "...agy-companion.mjs" research --write < "$TMPDIR/agy_prompt.txt"`.
