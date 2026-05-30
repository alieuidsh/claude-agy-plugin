---
description: Have Google Antigravity (Gemini) review the local git diff as a second opinion
argument-hint: "[--wait|--background] [focus for the review]"
allowed-tools: Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an agy (Antigravity / Gemini) code review against the local git diff.
Review-only — do not fix anything here.

Raw arguments: $ARGUMENTS

Execution mode:
- If `--wait`, run foreground. If `--background`, run as a Claude background task.
- Otherwise estimate diff size with `git status --short` + `git diff --shortstat`;
  recommend background for anything non-tiny via `AskUserQuestion` (one question).

Foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" review "$ARGUMENTS"
```

Background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" review "$ARGUMENTS"`,
  description: "agy review",
  run_in_background: true
})
```
After background launch, tell the user: "agy review started. Check `/agy:status`."

Return agy's review verbatim. Do not fix the issues it raises in this command.
