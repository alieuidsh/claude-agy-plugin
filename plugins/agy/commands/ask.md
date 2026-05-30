---
description: Ask Google Antigravity (Gemini) a one-shot question and return its answer
argument-hint: "[your question for Gemini]"
allowed-tools: Bash(node:*)
---

Ask agy (Antigravity / Gemini) the user's question and return its answer verbatim.

User's question:
$ARGUMENTS

Steps:
1. If `$ARGUMENTS` is empty, ask the user what they want to ask agy. Otherwise proceed.
2. Run the companion (it handles agy's stdout-capture quirk, UTF-8, and timeout):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" ask "$ARGUMENTS"
```

3. Return agy's answer to the user. You MAY add a one-line attribution like
   "— agy / Gemini" but do not rewrite agy's content.
4. If the command exits non-zero (timeout/auth), tell the user to run `/agy:setup`
   to diagnose. Do NOT loop-retry.
