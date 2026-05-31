---
description: Have Google Antigravity (Gemini) review the local git diff (read-only)
argument-hint: "[focus]"
allowed-tools: Bash(node:*), Bash(git:*), Write
---

agy (Gemini) reviews the local git diff. **Always read-only** — agy cannot edit here
(use `/agy:rescue` to act on findings). The companion gathers the diff itself
(including brand-new untracked files via intent-to-add).

Optional focus:
$ARGUMENTS

Steps:
1. If there is focus text, `Write` it to a UNIQUE temp file
   `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt` and pipe via stdin; else pipe empty
   stdin (`< /dev/null`, Windows `< NUL`). Never a fixed filename.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" review < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
2. Return agy's review verbatim. Do not fix issues in this command.
