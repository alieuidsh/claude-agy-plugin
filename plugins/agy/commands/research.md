---
description: Ask Google Antigravity (Gemini) to research a question and synthesize an answer
argument-hint: "[research question]"
allowed-tools: Bash(node:*), Write
---

Have agy (Gemini) research a question; return a synthesized answer.

Question:
$ARGUMENTS

Steps:
1. If empty, ask what to research.
2. **Injection-safe**: `Write` the question to a UNIQUE temp file
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` (Windows `%TEMP%\...`), then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" research < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (Windows: `%TEMP%\...` then `del`.)
3. Present the answer, attributed to agy/Gemini; treat as a second opinion.

Permissions: read-only by default.
