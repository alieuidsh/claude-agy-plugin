---
description: Run an adversarial Google Antigravity (Gemini) review of the local git diff (read-only)
argument-hint: "[focus]"
allowed-tools: Bash(node:*), Bash(git:*), Write
---

agy (Gemini) does a ruthless adversarial review of the local git diff. **Always
read-only** — use `/agy:rescue` to act on findings. The companion gathers the diff
itself (incl. brand-new untracked files via intent-to-add).

Optional focus:
$ARGUMENTS

Steps:
1. Focus text → `Write` to UNIQUE temp file `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt`,
   pipe via stdin; else empty stdin (`< /dev/null`, Windows `< NUL`).

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" adversarial-review < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
2. Return the review verbatim. Do not fix issues here.
