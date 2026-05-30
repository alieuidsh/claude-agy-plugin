# Test Matrix

Honest record of what has actually been verified, so users know the real maturity.
**Status: works well on Windows; Linux/macOS are designed-for but not yet hardware-verified.**

## Automated tests (parser core)

`npm test` (or `node tests/extract-answer.test.mjs`) — pure Node, no deps. Covers the
transcript parser, which is the heart of the plugin:

| Case | Covered |
|---|---|
| Single-segment answer | ✅ |
| Long answer chunked across multiple rows (joined in step order) | ✅ |
| Multiple runs in one transcript (run-scoping, no bleed-in) | ✅ |
| Schema drift — renamed fields recovered by heuristic | ✅ |
| Nonce not present → no stale answer | ✅ |
| Malformed / truncated JSONL lines skipped | ✅ |
| Unrecoverable drift → format-drift hand-off to Claude | ✅ |
| No chain-of-thought leak (thinking/plan fields excluded) | ✅ |
| Short answers kept (no length gate) | ✅ |
| Planning/tool-only rows → null (fall through to layer-2) | ✅ |

## Environment matrix (manual)

| OS | Node | agy CLI | `/agy:setup` | `/agy:ask` | `/agy:review` | parallel `/agy:ask` ×2 | `/agy:cancel` | `/agy:install` |
|---|---|---|---|---|---|---|---|---|
| Windows 11 | 24.x | 1.0.x | ✅ | ✅ | ✅ (via diff) | ✅ | ✅ (by PID) | ✅ "already installed" branch; full install not re-run |
| Ubuntu | — | — | ⏳ not yet | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| macOS | — | — | ⏳ not yet | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

Legend: ✅ verified · ⏳ designed-for, not yet tested on real hardware.

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
