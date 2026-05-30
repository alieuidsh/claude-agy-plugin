---
description: Ask Google Antigravity (Gemini) to research a question and return a synthesized answer
argument-hint: "[research question]"
allowed-tools: Bash(node:*)
---

Have agy (Antigravity / Gemini) research a question and return a synthesized answer.

Research question:
$ARGUMENTS

Steps:
1. If `$ARGUMENTS` is empty, ask the user what to research. Otherwise proceed.
2. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" research "$ARGUMENTS"
```

3. Present agy's synthesized answer, attributed to agy / Gemini. Treat it as a
   second opinion and apply your own judgment.
