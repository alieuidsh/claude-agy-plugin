---
description: Have Google Antigravity (Gemini) review the local git diff as a second opinion
argument-hint: "[--wait|--background] [focus for the review]"
allowed-tools: Bash(node:*), Bash(git:*), Write, AskUserQuestion
---

Run an agy (Antigravity / Gemini) code review against the local git diff.
**Review-only: agy ALWAYS runs read-only here and cannot edit files** — to act on
findings, use `/agy:rescue`.

Raw arguments (may include --wait / --background and focus text):
$ARGUMENTS

Steps:
1. Strip `--wait` / `--background`; the rest is optional focus text. Ignore any
   `--write` — review never writes (use `/agy:rescue` if you want edits).
2. **Injection-safe input**: if there is focus text, use the `Write` tool to save
   it to a **uniquely-named** temp file `${TMPDIR:-/tmp}/agy_prompt_<unique>.txt`
   (Windows: `%TEMP%\agy_prompt_<unique>.txt`) and pipe it in via stdin. If there is
   NO focus text, pipe empty stdin (`< /dev/null`, or `< NUL` on Windows). Never put
   focus text in the shell command string; never reuse a fixed filename. The
   companion gathers the git diff itself.
3. Execution mode:
   - `--wait` / small diff → foreground:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" review < "$TMPDIR/agy_prompt_<unique>.txt"
rm -f "$TMPDIR/agy_prompt_<unique>.txt"
```
   (On Windows cmd: `... review < "%TEMP%\agy_prompt_<unique>.txt"` then `del "%TEMP%\agy_prompt_<unique>.txt"`.)
   - `--background` / large diff → same command with `Bash(..., run_in_background: true)`,
     then say: "agy review started. Check `/agy:status`." If unsure of size, use
     `AskUserQuestion` once (Wait vs Background).
4. Return agy's review verbatim. Do not fix the issues it raises in this command.
