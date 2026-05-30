# Security & Privacy

This plugin bridges Claude Code to the local **`agy`** (Google Antigravity / Gemini)
CLI. Please understand what that means before using it on sensitive work.

## Your code and prompts are sent to Google

Every `/agy:*` command sends your prompt — and, for `review` / `adversarial-review`,
your **git diff** (including brand-new files via intent-to-add) — to Google's
Antigravity / Gemini service through the `agy` CLI. Treat it like any other cloud AI:

- **Do not send secrets, credentials, regulated, medical, or unpublished-research
  data** you are not comfortable sharing with Google.
- This is the same class of consideration as using the official codex plugin (which
  sends to OpenAI). It is your responsibility to comply with your project's / grant's
  data-handling rules.

## Write-capable commands edit files autonomously

- `/agy:rescue` (and `task`) run agy **write-capable by default** — agy can create,
  modify, or delete files in the current project without asking.
- **Commit first (`git commit`)** so you can review with `git diff` and revert.
- `/agy:review` and `/agy:adversarial-review` are **always read-only** — agy cannot
  edit during a review, even if `--write` is passed.
- Read-only blocks file *edits*; agy is still an autonomous agent and may run shell
  commands to explore. Read-only is not a sandbox.

## Install path runs a remote script (with consent)

`/agy:install` runs Google's official installer (`irm …install.ps1 | iex` /
`curl …install.sh | bash`). The companion **refuses to install without `--yes`**, and
the slash command asks for your consent first. `check-install` only reports state and
never installs. Still, this downloads and executes a vendor script — only proceed if
you trust the source (`antigravity.google`).

## Injection hardening

- Prompts are passed to the companion via **stdin / a temp file**, never interpolated
  into a shell command line.
- `git` is invoked with an argv array (`shell: false`), not string concatenation.
- Job ids for `result` / `cancel` are validated against `^\d{8}_\d{6}_\d{4}$`.

## Reporting a vulnerability

This is an unofficial community plugin maintained best-effort. Open a GitHub issue
(or, for something sensitive, contact the maintainer privately) describing the
problem and how to reproduce it. There is no formal SLA.

## Trust boundary summary

| Surface | Trust note |
|---|---|
| Your prompt / diff | Leaves your machine → Google. Don't send secrets. |
| `rescue` writes | Autonomous file edits. Commit first. |
| `install --yes` | Runs a remote vendor script. Consent-gated. |
| agy transcript parsing | Reads `~/.gemini/antigravity-cli/`; not a stable API. |
