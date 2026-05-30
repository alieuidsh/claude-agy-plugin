---
description: Delegate a task, investigation, or fix to Google Antigravity (Gemini); agy may edit files
argument-hint: "[--background|--wait] [what agy should do, investigate, or fix]"
allowed-tools: Bash(node:*), AskUserQuestion
---

Delegate work to agy (Antigravity / Gemini). Unlike review, this is WRITE-capable:
agy may edit files in the current project to accomplish the task.

Raw request:
$ARGUMENTS

Execution mode:
- If `$ARGUMENTS` includes `--wait`, run in the foreground.
- If it includes `--background`, run as a Claude background task.
- Otherwise default to foreground for small asks; for anything that sounds like a
  multi-file change, use `AskUserQuestion` once to offer "Wait" vs "Run in background".

Foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" task "$ARGUMENTS"
```

Background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" task "$ARGUMENTS"`,
  description: "agy task",
  run_in_background: true
})
```
After launching in background, tell the user: "agy task started. Check `/agy:status`."

Return agy's output. Treat it as a capable collaborator's work — review its
changes before relying on them.
