# Test Matrix

Honest record of what has actually been verified, so users know the real maturity.
**Status: end-to-end verified on Windows; the parser core is CI-verified on Linux +
macOS + Windows (Node 18/20/22); end-to-end agy interaction on Linux/macOS is still
pending real hardware.**

## Continuous integration

GitHub Actions (`.github/workflows/test.yml`) runs `node --check` + `npm test` on a
**ubuntu-latest × macos-latest × windows-latest** matrix with **Node 18 / 20 / 22**
on every push and PR. This verifies the transcript parser — the plugin's core logic —
on real Linux and macOS runners.

What CI does **not** cover: it cannot call the real `agy` CLI (not installed / no
Google sign-in on runners), so end-to-end agy interaction on Linux/macOS still needs
a real machine (see the pending rows below).

## Automated tests (parser core)

`npm test` (or `node tests/extract-answer.test.mjs`) — pure Node, no deps. Covers the
transcript parser, which is the heart of the plugin:

| Case | Covered |
|---|---|
| Single-segment answer | ✅ |
| Long answer chunked across multiple rows (joined in step order) | ✅ |
| Out-of-order rows sorted by step_index (sort actually exercised) | ✅ |
| Multiple runs in one transcript (run-scoping, no bleed-in) | ✅ |
| Run A explicitly does NOT absorb run B's answer | ✅ |
| Overlapping nonces (`agy-1` substring of `agy-12`) each isolated | ✅ |
| Schema drift — renamed fields recovered by heuristic | ✅ |
| Nonce not present → no stale answer | ✅ |
| Malformed / truncated JSONL lines skipped | ✅ |
| Non-object JSONL rows (bare `null`/number/`true`) don't crash | ✅ |
| Unrecoverable drift → format-drift hand-off to Claude | ✅ |
| **Precise** parser drops planning (PLANNER_RESPONSE before a tool call) | ✅ |
| No chain-of-thought leak — heuristic path (thinking/plan excluded) | ✅ |
| Short answers kept (no length gate) | ✅ |
| Planning/tool-only rows → null (fall through to layer-2) | ✅ |
| Heuristic joins multi-row recovery in step order | ✅ |

**Chain-of-thought handling (honest scope):** agy emits its own reasoning/plan as
`PLANNER_RESPONSE` rows too, interleaved with tool calls. The precise parser takes
only the **last contiguous group** of MODEL response rows, so planning steps that
are separated from the answer by a tool call are dropped (tested). The residual edge
case is reasoning emitted as a `PLANNER_RESPONSE` *immediately* before the answer
with **no** intervening tool call — those would still join. That isn't agy's observed
pattern, but it's a known limit, not a guaranteed-impossible one.

**Big prompts:** prompts over ~8 KB (e.g. a large diff for review) are written to a
temp file and agy is told to read it, avoiding the OS command-line length limit
(`spawn ENAMETOOLONG`). The temp file is deleted after the run.

## Environment matrix (manual)

| OS | Node | agy CLI | parser (`npm test`) | `check-install` / `status` (Linux paths) | full agy interaction |
|---|---|---|---|---|---|
| Windows 11 | 24.x | 1.0.x | ✅ 18/18 | ✅ | ✅ setup/ask/review/parallel/cancel; install "already-installed" branch |
| Linux x86_64 (Ubuntu-class) | 22.x | not installed | ✅ 18/18 (real hardware) | ✅ `findAgy` returns null cleanly; `~/.agy-jobs` path OK | ⏳ needs agy + Google sign-in |
| macOS | — | — | ✅ via CI (Node 18/20/22) | ⏳ | ⏳ needs agy + Google sign-in |

Legend: ✅ verified · ⏳ not yet on real hardware. The parser core (the plugin's
brain) is now verified on real Linux + Windows and on CI across all three OSes; the
remaining ⏳ is the live agy round-trip, which needs the agy CLI installed and a
Google sign-in on that box.

## Known not-yet-verified

- **Real Linux/macOS run** — companion has cross-platform code paths (binary
  detection, `process.kill(-pid)`, install command), but only Windows is hardware-tested.
- **A real agy version change** — self-heal (heuristic + Claude hand-off) is tested
  against *simulated* drifted transcripts, not an actual upstream format change.
- **Full from-scratch `/agy:install`** — only the "already installed" / "refuse without
  --yes" branches were exercised; the actual remote install wasn't re-run on a clean box.

## How to contribute a verified row

Run on your OS, then add a row above with your Node + agy versions and which commands
passed. PRs welcome.
