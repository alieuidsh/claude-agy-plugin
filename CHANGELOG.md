# Changelog

All notable changes to this project are documented here. Versions follow
[SemVer](https://semver.org/). The `agy` plugin version is kept in sync across
`plugins/agy/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and
`package.json`.

## [1.4.4]

### Fixed
- **`/agy:review` was blind to brand-new untracked files** (functional bug): the
  diff collector only ran `git diff [--cached]`, so a not-yet-added file appeared
  only as `?? foo.js` with no content. Now runs `git add -N -- .` (intent-to-add,
  stages no content) before diffing, so new files show up as new-file hunks.
- `extractAnswer` no-nonce branch lacked the non-object row guard added elsewhere
  in 1.4.2; a bare `null` JSONL line could throw. Guarded.
- `/agy:status` and `/agy:result`: `statSync` is now wrapped so a concurrent job
  deleting a metadata file mid-listing no longer crashes the whole listing.

### Added
- Orphaned big-prompt temp files (`prompt_*.txt` older than 1h) are swept on each run.

### Changed
- Documented the cancel-vs-onSpawn metadata race as an accepted known issue
  (sub-millisecond window, self-limits via the run timeout).

### Chore
- Removed dev scratch files from the repo; added `_*.txt` to `.gitignore`.

## [1.4.3]

### Changed
- Synced `SKILL.md` (the natural-language trigger path) with the current behavior:
  unique temp filenames, `review`/`adversarial-review` always read-only, the
  `check-install` / `install --yes` split, and a softened backend-model description.

## [1.4.2]

### Fixed
- **Large prompts no longer crash with `spawn ENAMETOOLONG`**: a prompt over ~8 KB
  (e.g. a big review diff) is written to a temp file the companion tells agy to read,
  avoiding the OS command-line length limit. The temp file is deleted after the run.
- Chain-of-thought leak in the precise parser: it now takes only the last contiguous
  group of MODEL responses, dropping planning rows separated from the answer by a
  tool call.
- `driftHandoffBlock` strips the full control range (incl. DEL and C1) from paths.
- Non-object JSONL rows (bare `null`/number) no longer crash the parser.
- `isMain` guard uses `pathToFileURL` for correct percent-encoding.

### Added
- Command docs gained Windows `del` cleanup beside the Unix `rm -f`.
- Parser test suite expanded to 18 cases (CoT precise path, non-object rows,
  out-of-order `step_index`, overlapping nonces, explicit non-bleed).

## [1.4.1]

### Fixed
- Hotfix for a 1.4.0 load-breaking syntax error (the `main()` wrapper close) and a
  missing `extractFromRows` definition.

## [1.4.0]

### Added
- **Two-layer self-heal** for agy transcript-format drift: a format-agnostic
  heuristic, then an `AGY_NEEDS_CLAUDE_EXTRACTION` hand-off so the calling assistant
  recovers the answer with no plugin update.
- Parser refactored into pure, unit-testable functions with an import guard, plus
  `tests/` + `fixtures/` and `TEST_MATRIX.md`.

### Changed
- Permissions aligned with codex: safe per-command default + `--write` / `--read-only`
  override. `review` / `adversarial-review` forced read-only.
- `git()` rewritten to `spawnSync` argv-array (no shell interpolation).
- Prompt passed via stdin (injection-safe); command docs use unique temp filenames.
- `/agy:install` split into `check-install` (never installs) and `install --yes`.
- READMEs in 9 languages; added an "unofficial community plugin" disclaimer.

## [1.0.0] – [1.3.x]

- Initial plugin: 9 commands (`ask`, `rescue`, `research`, `review`,
  `adversarial-review`, `setup`, `status`, `result`, `cancel`) plus an
  auto-trigger skill, a cross-platform Node companion that reads agy's on-disk
  transcript (since `agy --print` writes to the TTY, not stdout), per-job nonce
  correlation, PID-tracked job cancel, and silent keyring auth.
- Added `/agy:install` (auto-install the agy CLI on consent) and a self-update note.
