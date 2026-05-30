---
description: Run an adversarial Google Antigravity (Gemini) review that tries to break the local diff
argument-hint: "[--wait|--background] [focus]"
allowed-tools: Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an ADVERSARIAL agy (Antigravity / Gemini) review of the local git diff — agy
plays a ruthless reviewer hunting for bugs, security holes, edge cases, and bad
design tradeoffs. Review-only — do not fix anything here.

Raw arguments: $ARGUMENTS

Execution mode:
- If `--wait`, foreground. If `--background`, Claude background task.
- Otherwise estimate diff size and recommend background for non-tiny diffs via
  `AskUserQuestion` (one question).

Foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" adversarial-review "$ARGUMENTS"
```

Background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" adversarial-review "$ARGUMENTS"`,
  description: "agy adversarial review",
  run_in_background: true
})
```
After background launch: "agy adversarial review started. Check `/agy:status`."

Return agy's review verbatim. Do not fix the issues here.
