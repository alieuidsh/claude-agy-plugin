# HANDOFF — agy plugin: add auto-install of the agy CLI (v1.2.0)

## What this session is doing RIGHT NOW (the only unfinished task)
Add a way for the plugin to **detect that the user has NOT installed the `agy` CLI,
report it, guide them, and (with consent) install it for them**. User chose:
**"偵測 + 引導 + 經同意才裝"** (detect → guide → install only after user agrees).
Do NOT auto-install without asking.

## OFFICIAL agy install commands (verified via web search, antigravity.google/docs/cli-install)
- **Windows (PowerShell):** `irm https://antigravity.google/cli/install.ps1 | iex`
- **macOS/Linux:** `curl -fsSL https://antigravity.google/cli/install.sh | bash`
- After install, binary lands at: Windows `%LOCALAPPDATA%\Antigravity\` (note: NOT
  `...\agy\bin\` — the installer path may differ from this machine's older layout;
  findAgy() already checks `%LOCALAPPDATA%\agy\bin\agy.exe` — ALSO add a check for
  `%LOCALAPPDATA%\Antigravity\agy.exe` and `~/.local/bin/agy` for Unix).
- Update mechanism (already documented): `agy update`.

## EXACT remaining steps
1. **Add `install` subcommand** to `C:\Users\MITAli\agy-plugin\plugins\agy\scripts\agy-companion.mjs`:
   - New `async function cmdInstall()`: detect OS via `IS_WIN`; if agy already found
     (`findAgy()` non-null) print "already installed at <path>" and exit 0.
     Otherwise run the official installer:
     - Win: `spawn`/`execSync` `powershell -Command "irm https://antigravity.google/cli/install.ps1 | iex"`
     - Unix: `bash -c "curl -fsSL https://antigravity.google/cli/install.sh | bash"`
     - Capture output, then re-run `findAgy()` to verify; print success/failure.
   - Add `case "install": code = await cmdInstall(); break;` to the dispatch switch
     (near `case "setup":` ~line 454+ in current file).
2. **Improve the "not installed" message** in `findAgy()` callers. The cleanest spot:
   in `runAgy()` where it does `done({ ok:false, error: "agy binary not found..." })`
   (~line 81-83), and in `cmdSetup()` (the `if (!exe)` branch ~line 387). Change the
   text to: not-installed + official command for their OS + "or run /agy:install to
   let me install it for you (asks first)".
3. **Add `install.md` command file**: `C:\Users\MITAli\agy-plugin\plugins\agy\commands\install.md`
   - frontmatter: `description: Install the agy (Antigravity/Gemini) CLI if missing`,
     `allowed-tools: Bash(node:*), Bash(powershell:*), AskUserQuestion`
   - Body: first run companion `setup` (or a detect). If missing, use AskUserQuestion
     to confirm, THEN run `node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" install`.
     Tell user to restart + run `agy` once to sign in (Google account) after install.
4. **Update `setup.md`**: mention `/agy:install` as the fix when binary NOT FOUND.
5. **Update SKILL.md**: add `install` to the subcommand list; note the auto-install flow.
6. **9 READMEs** (README.md + README.{zh-TW,zh-CN,ja,ru,de,fr,es,it}.md): add an
   "Installing the agy CLI" note — official commands per OS + mention `/agy:install`.
   Each README has a Prerequisites section already; augment it. Keep the language-switch
   header row intact (8 links each).
7. **Bump version 1.1.0 → 1.2.0** in BOTH:
   - `plugins/agy/.claude-plugin/plugin.json` (one `"version"`)
   - `.claude-plugin/marketplace.json` (TWO `"version"` fields: metadata + plugins[0])
8. **Verify**: `cd C:/Users/MITAli/agy-plugin && node --check plugins/agy/scripts/agy-companion.mjs`
   (must print nothing / exit 0). Functional smoke test of a harmless path, e.g.
   `node plugins/agy/scripts/agy-companion.mjs setup` (it WILL find agy on this machine,
   so test the "already installed" branch of cmdInstall: `node ... install` should say
   already installed). DO NOT actually reinstall on this machine.
9. **Validate + commit + push + tag + reinstall**:
   - `claude plugin validate C:/Users/MITAli/agy-plugin` (run from repo dir, expect "Validation passed")
   - `cd C:/Users/MITAli/agy-plugin && git add -A && git -c commit.gpgsign=false commit -m "..."`
   - `export PATH="$PATH:/c/Program Files/GitHub CLI" && git push origin main`
   - `git tag -a v1.2.0 -m "..." && git push origin v1.2.0`
   - reinstall local: `claude plugin marketplace remove suho-agy; claude plugin marketplace add C:/Users/MITAli/agy-plugin; claude plugin install agy@suho-agy`
   - commit message MUST end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## CRITICAL environment gotchas (learned the hard way this session)
- **Tool-output relay stalls intermittently.** When a big batch of parallel tool
  calls is sent, sometimes outputs stop rendering. Mitigation: send SMALLER batches,
  and after a Write/Edit just trust it succeeded (don't re-Read to verify — it errors
  if the edit failed). If output stalls, do a tiny `Bash("echo ok")` probe; it recovers.
- **PowerShell tool**: `$LASTEXITCODE` embedded inside a double-quoted string literal
  causes a parser error that CANCELS the whole parallel batch. Avoid it.
- **agy answers via stdin now** (injection-safe). To test ask: `echo "..." | node ... ask --timeout 120`.
  agy is SLOW (multi-step); use background Bash + Monitor with an until-grep loop on
  the task .output file, timeout ~140000ms. agy answer is read from transcript, not stdout.
- **Reading agy output cleanly**: read the job file `C:/Users/MITAli/.agy-jobs/<id>.out.txt`
  or the transcript; bash `$(...)` capture garbles Chinese.
- **git autocrlf=true** on this machine → commits show CRLF warnings; harmless (.gitattributes forces LF).
- **claude plugin tag** failed (wanted plugin.json in cwd root) — use plain `git tag` instead.
- After ANY plugin file change, must `claude plugin marketplace remove/add + install` to
  refresh local, AND user must restart Claude Code for slash commands to reload.

## PROJECT STATE (fully working, v1.1.0 shipped)
- **Repo**: `alieuidsh/claude-agy-plugin` (PUBLIC), HEAD before this task = commit with
  tag `v1.1.0`. Branch `main`. gh CLI installed + authed (account alieuidsh).
- **Local source**: `C:\Users\MITAli\agy-plugin\` (git repo). Installed as `agy@suho-agy`.
- **What it is**: Claude Code plugin = agy (Google Antigravity / Gemini) counterpart to
  the codex plugin. 9 commands: /agy:ask /rescue /research /review /adversarial-review
  /setup /status /result /cancel (install will be the 10th).
- **Companion**: `plugins/agy/scripts/agy-companion.mjs` (~470 lines, pure Node, cross-platform).
  Key functions: findAgy() (binary detect), runAgy() (spawn agy --print, read answer from
  ~/.gemini/antigravity-cli/brain transcript via nonce correlation), extractAnswer()
  (returns {answer, formatDrift}), runJob/cmdStatus/cmdResult/cmdCancel/cmdSetup, parseFlags
  (writeOverride for --write/--read-only), resolveReadOnly().
- **Permissions**: codex-aligned. ask/research/review/adversarial-review default read-only;
  task/rescue default write. `--write`/`--read-only` override. Prompt via stdin (no injection).
- **Already passed 3 rounds of codex+agy+Claude security review (15 bugs fixed).** Plus a
  format-drift health-check (tells user to /plugin update agy if agy's transcript format changes).
- **Update mechanism**: `/plugin update agy` (public repo → everyone gets fixes). Version bump
  in plugin.json+marketplace.json is REQUIRED for update detection.
- **Memory file**: `C:\Users\MITAli\.claude\projects\C--Users-MITAli-OneDrive-NIU-MIT\memory\project_agy_antigravity_integration.md`
  has full history — update it after finishing (bump HEAD/tag/version notes, add install feature).

## Tasks tracking (TaskCreate IDs this session)
- #15 (in_progress): companion 加 install 子指令
- #16: setup/各指令 未裝時引導
- #17: install 驗證+9語README+發版
Mark them done as you go.

## After everything: tell the user (in 繁體中文)
- /agy:install added; new users without the agy CLI get detected, guided, and installed
  on consent. Official commands documented in 9 languages. Released as v1.2.0.
- Remind: after install, user must run `agy` once interactively to sign in (Google account).
- Offer to run /save-context.
