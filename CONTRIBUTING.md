# Contributing

Thanks for helping improve this plugin. It's an unofficial community bridge between
Claude Code and the `agy` (Google Antigravity / Gemini) CLI, so the most valuable
contributions are **real-world verification** and **parser robustness**.

## Running the tests

The core of the plugin is the transcript parser. It has a pure-Node test suite (no
dependencies):

```bash
npm test          # or: node tests/extract-answer.test.mjs
```

All cases must pass before you open a PR. If you fix a parser bug, add a fixture in
`tests/fixtures/` and a case in `tests/extract-answer.test.mjs` that fails before
your fix and passes after.

## Most-wanted: verify on your OS

The matrix in [TEST_MATRIX.md](TEST_MATRIX.md) is honest about what's verified
(Windows) vs designed-for (Linux/macOS). If you run it on Linux or macOS, please:

1. Install the agy CLI and sign in (`/agy:setup`).
2. Try: `/agy:setup`, `/agy:ask`, `/agy:review` (with a staged diff **and** a brand-new
   untracked file), `/agy:rescue --read-only`, two parallel `/agy:ask`, `/agy:cancel`.
3. Add a row to TEST_MATRIX.md with your OS, Node version, agy version, and which
   commands passed. PRs with a verified row are very welcome.

## Code style / ground rules

- **Pure Node, no dependencies.** Keep the companion (`plugins/agy/scripts/agy-companion.mjs`)
  dependency-free and cross-platform (Windows + Linux + macOS).
- **No user text on a shell command line** — prompts go via stdin/temp file; external
  commands use argv arrays (`spawnSync(cmd, [...])`, not string concatenation).
- **Validate before push:** `node --check plugins/agy/scripts/agy-companion.mjs` and
  `npm test` must be clean. (We learned this the hard way — a syntax error once shipped.)
- **Bump the version in all three places** when you change behavior: `plugin.json`,
  `marketplace.json` (two fields), and `package.json`. Add a `CHANGELOG.md` entry.

## Reporting bugs

Open an issue with: your OS + Node + agy versions, the command you ran, and what you
expected vs got. Transcript-parsing bugs are especially useful with an anonymized
`transcript.jsonl` snippet.

## Releasing (maintainer)

1. `npm test` + `node --check` clean.
2. Bump version (3 files), update `CHANGELOG.md`.
3. `claude plugin validate .`
4. Commit, push, `git tag -a vX.Y.Z`, push the tag.
