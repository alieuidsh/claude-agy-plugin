#!/usr/bin/env node
// agy-companion.mjs (v2) — runtime for the agy (Google Antigravity / Gemini)
// Claude Code plugin. The agy analogue of codex-companion.mjs.
//
// WHY v2 IS DIFFERENT FROM v1 (the root-cause we learned the hard way):
//   agy 1.0.x produces NO output and writes NO transcript unless it detects a REAL
//   console/TTY. Headless `spawn(agy)`, piping, even Task Scheduler all yield empty
//   output. The ONLY thing that works programmatically is a SYNTHESIZED console via
//   ConPTY — i.e. node-pty. So v2 runs agy inside a node-pty pseudo-terminal, reads
//   its stdout, strips ANSI/BOM, and extracts the answer. We do NOT read transcripts.
//
// node-pty is a native dep, but ships PREBUILT binaries for common Node/OS combos,
// so `npm install` needs no C++ toolchain in the normal case.
//
// Subcommands:
//   ask | task | research | review | adversarial-review   (prompt via stdin)
//   setup | check-install | install | status | result | cancel
//
// Exports (for unit tests): cleanOutput, extractAnswer  — importing does NOT run main.

import { spawn as cpSpawn, spawnSync, execSync } from "node:child_process";
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync, rmdirSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// require() resolved relative to THIS script — finds <pluginRoot>/node_modules/node-pty
// regardless of cwd, and (unlike dynamic import) does not cache a failed first load.
const _require = createRequire(import.meta.url);

const HOME = homedir();
const IS_WIN = platform() === "win32";
const JOBS = join(HOME, ".agy-jobs");
const DEFAULT_TIMEOUT_MS = 300_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 1_800_000;
const JOB_ID_RE = /^\d{8}_\d{6}_\d{4}$/;

// ---------- locate the agy binary (cross-platform) ----------
function findAgy() {
  if (process.env.AGY_BIN && existsSync(process.env.AGY_BIN)) return process.env.AGY_BIN;
  const c = [];
  if (IS_WIN) {
    const la = process.env.LOCALAPPDATA || join(HOME, "AppData", "Local");
    c.push(join(la, "agy", "bin", "agy.exe"), join(la, "Antigravity", "agy.exe"), join(la, "Antigravity", "bin", "agy.exe"));
  } else {
    c.push(join(HOME, ".local", "bin", "agy"), join(HOME, ".agy", "bin", "agy"), "/usr/local/bin/agy", "/usr/bin/agy");
  }
  for (const p of c) if (existsSync(p)) return p;
  try {
    const out = execSync(IS_WIN ? "where agy" : "command -v agy", { encoding: "utf8" });
    const exe = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).find((p) => existsSync(p));
    if (exe) return exe;
  } catch { /* not on PATH */ }
  return null;
}

// ---------- node-pty loader with one-time AUTO-INSTALL + self-heal ----------
// Claude Code copies only the plugin dir on install (no `npm install` step), so a
// fresh install has no node_modules. On first use we install node-pty into the
// plugin dir ourselves — like apps that fetch their deps on first run. Concurrency
// is guarded by an atomic mkdir lock; a stale lock (>6 min) is reclaimed.
let _ptyCache; // undefined = unknown, null = unavailable, object = the module
function importPtySync() { try { return _require("node-pty"); } catch { return null; } }
function ptyInstallDir() {
  if (process.env.CLAUDE_PLUGIN_ROOT && existsSync(process.env.CLAUDE_PLUGIN_ROOT)) return process.env.CLAUDE_PLUGIN_ROOT;
  try { return dirname(dirname(fileURLToPath(import.meta.url))); } catch { return process.cwd(); } // scripts/ -> pluginRoot
}
function npmBin() { return IS_WIN ? "npm.cmd" : "npm"; }
// Node 18+ refuses to spawn a .cmd (npm.cmd) with shell:false (EINVAL), so on Windows
// we must use shell:true. Safe here: the command + args are fixed literals, never user
// input. On POSIX npm is a real executable, so shell:false stays.
function hasNpm() { try { return spawnSync(npmBin(), ["--version"], { encoding: "utf8", shell: IS_WIN, timeout: 20_000 }).status === 0; } catch { return false; } }
function npmInstallInto(dir) {
  process.stderr.write(`[agy] first run: installing node-pty into ${dir} (one-time; needs npm + network)...\n`);
  try {
    const r = spawnSync(npmBin(), ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dir, encoding: "utf8", shell: IS_WIN, timeout: 300_000 });
    if (r.status !== 0) { process.stderr.write(`[agy] npm install failed: ${String(r.stderr || r.stdout || "").trim().slice(0, 400)}\n`); return false; }
    process.stderr.write("[agy] node-pty installed.\n"); return true;
  } catch (e) { process.stderr.write(`[agy] npm install error: ${e.message}\n`); return false; }
}
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ensurePty({ autoInstall = true } = {}) {
  if (_ptyCache !== undefined) return _ptyCache;
  let mod = importPtySync();
  if (mod) return (_ptyCache = mod);
  if (!autoInstall) return (_ptyCache = null);
  const dir = ptyInstallDir();
  if (!existsSync(join(dir, "package.json"))) { process.stderr.write(`[agy] cannot auto-install node-pty: no package.json in ${dir}\n`); return (_ptyCache = null); }
  if (!hasNpm()) { process.stderr.write(`[agy] node-pty missing and npm not on PATH. Install Node.js, or run \`npm install\` in ${dir}\n`); return (_ptyCache = null); }
  const lock = join(dir, ".agy-pty-install.lock");
  try { const st = statSync(lock); if (Date.now() - st.mtimeMs > 360_000) rmdirSync(lock); } catch { /* no stale lock */ }
  let owner = false;
  try { mkdirSync(lock); owner = true; } catch { /* another process is installing */ }
  if (owner) {
    try { npmInstallInto(dir); } finally { try { rmdirSync(lock); } catch {} }
  } else {
    for (let i = 0; i < 150; i++) { mod = importPtySync(); if (mod) return (_ptyCache = mod); if (!existsSync(lock)) break; await _sleep(2_000); }
  }
  return (_ptyCache = importPtySync());
}

// ---------- clean agy's raw PTY output into a plain answer (PURE, testable) ----------
// Removes: UTF-8 BOM, ANSI CSI/OSC/other escapes, lone CR, other control chars.
export function cleanOutput(raw) {
  if (typeof raw !== "string") return "";
  let s = raw;
  s = s.replace(/﻿/g, "");                                  // BOM (anywhere)
  s = s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");      // OSC ... BEL/ST
  s = s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");              // CSI
  s = s.replace(/\x1b[=>]/g, "").replace(/\x1b[()][AB0-2]/g, "");// charset/keypad
  s = s.replace(/\r\n/g, "\n");                                  // CRLF -> LF (PTY uses CRLF)
  s = s.replace(/\r/g, "");                                      // any remaining lone CR (drip redraws)
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");        // other control (keep \n \t)
  return s;
}

// extractAnswer: from cleaned text, return the substantive answer.
// agy's --print in PTY mode prints just the model reply (no transcript framing),
// so after cleaning we mostly need to trim. We also drop a leading echo of the
// prompt if agy echoes it, and collapse excess blank lines.
export function extractAnswer(rawOutput) {
  const clean = cleanOutput(rawOutput).replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

// ---------- run agy inside a ConPTY and capture the answer ----------
async function runAgy(prompt, { readOnly = false, timeoutMs = DEFAULT_TIMEOUT_MS, onSpawn } = {}) {
  const exe = findAgy();
  if (!exe) return { ok: false, error: "agy CLI not installed. Run /agy:install (asks first), or install manually: " + officialInstallCmd() };
  const pty = await ensurePty();
  if (!pty) return { ok: false, error: "node-pty unavailable and auto-install failed. Ensure Node.js/npm are installed and you have network, then run /agy:setup. (v2 needs a synthesized console to drive agy.)" };

  const args = [];
  if (!readOnly) args.push("--dangerously-skip-permissions");
  args.push("--print", prompt);

  return await new Promise((resolve) => {
    let buf = "";
    let settled = false;
    let timer = null;
    // Only kill when WE need to abort (timeout). If agy already exited, killing the
    // ConPTY triggers node-pty's console-list helper, which throws a noisy (benign)
    // "AttachConsole failed" in headless shells. Don't kill an already-dead child.
    const done = (v, doKill = false) => {
      if (settled) return; settled = true;
      if (timer) { try { clearTimeout(timer); } catch {} }
      if (doKill) { try { child.kill(); } catch {} }
      resolve(v);
    };
    let child;
    try {
      child = pty.spawn(exe, args, {
        name: "xterm-256color", cols: 140, rows: 40,
        cwd: IS_WIN ? (process.env.TEMP || HOME) : HOME,
        env: process.env,
      });
    } catch (e) {
      return resolve({ ok: false, error: `failed to spawn agy in pty: ${e.message}` });
    }
    if (onSpawn && child.pid) { try { onSpawn(child.pid); } catch {} }
    child.onData((d) => { buf += d; });
    child.onExit(({ exitCode }) => {
      const answer = extractAnswer(buf);
      if (!answer) done({ ok: false, error: `agy produced no answer (exit ${exitCode}). If this persists, the agy CLI may have changed or needs re-auth (run \`agy\` once interactively).` });
      else done({ ok: true, answer });
    });
    timer = setTimeout(() => {
      const partial = extractAnswer(buf);
      done(partial ? { ok: true, answer: partial } : { ok: false, error: `agy timed out after ${Math.round(timeoutMs / 1000)}s.` }, true);
    }, timeoutMs);
    if (timer.unref) timer.unref();
  });
}

// ---------- install helpers ----------
function officialInstallCmd() {
  return IS_WIN
    ? `powershell -NoProfile -Command "irm https://antigravity.google/cli/install.ps1 | iex"`
    : `curl -fsSL https://antigravity.google/cli/install.sh | bash`;
}
function notInstalledHint() {
  return ["The agy (Google Antigravity) CLI is not installed.", "", "Install it:", `  ${officialInstallCmd()}`,
    "", "Or run `/agy:install` (asks first). After installing, run `agy` once interactively to sign in."].join("\n");
}

// ---------- job metadata ----------
function ensureJobs() {
  try {
    if (existsSync(JOBS)) { if (!statSync(JOBS).isDirectory()) { console.error(`[agy] ${JOBS} is not a directory.`); process.exit(1); } }
    else mkdirSync(JOBS, { recursive: true });
  } catch (e) { console.error(`[agy] cannot init jobs dir: ${e.message}`); process.exit(1); }
}
function safeJobId(id) { return id && JOB_ID_RE.test(id) ? id : null; }
function jobMeta(id) { return join(JOBS, `${id}.meta.json`); }
function jobOut(id) { return join(JOBS, `${id}.out.txt`); }
function newJobId() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${Math.floor(Math.random() * 9000 + 1000)}`;
}
function readMeta(id) { return JSON.parse(readFileSync(jobMeta(id), "utf8")); }
function writeMeta(id, m) { writeFileSync(jobMeta(id), JSON.stringify(m, null, 2), "utf8"); }

// ---------- git (argv form, no shell) ----------
function git(argv) {
  try { const r = spawnSync("git", argv, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, shell: false }); return r.status === 0 && typeof r.stdout === "string" ? r.stdout : ""; }
  catch { return ""; }
}
function collectDiff() {
  const status = git(["status", "--short", "--untracked-files=all"]);
  git(["add", "-N", "--", "."]); // intent-to-add so brand-new files appear in diff
  const diff = (git(["diff", "--cached"]) + "\n" + git(["diff"])).trim();
  return { status, diff };
}
function reviewPrompt(focus, diff, adversarial) {
  const role = adversarial
    ? "You are a ruthless adversarial senior code reviewer. Try to BREAK this change: bugs, security, edge cases, bad tradeoffs."
    : "You are a careful senior code reviewer. Find correctness bugs, risky edge cases, and clear improvements.";
  return `${role}\nReview ONLY the diff below. Do NOT modify files — review only.\nMost-severe first, each with file:line and a concrete fix.\n${focus ? `Extra focus: ${focus}\n` : ""}\n=== DIFF ===\n${diff || "(no diff detected)"}`;
}

function readStdin() {
  try { return readFileSync(0, "utf8").replace(/\r\n/g, "\n").trim(); } catch { return ""; }
}

// ---------- run + record a job ----------
async function runJob(kind, prompt, { readOnly, timeoutMs }) {
  ensureJobs();
  const id = newJobId();
  writeMeta(id, { id, kind, status: "running", prompt: prompt.replace(/\s+/g, " ").slice(0, 200), pid: null, start: new Date().toISOString(), end: null });
  process.stderr.write(`[agy] job ${id} (${kind}) started\n`);
  const r = await runAgy(prompt, { readOnly, timeoutMs, onSpawn: (pid) => { try { const m = readMeta(id); m.pid = pid; writeMeta(id, m); } catch {} } });
  const out = r.ok ? r.answer : `ERROR: ${r.error}`;
  writeFileSync(jobOut(id), out, "utf8");
  const m = readMeta(id); m.status = r.ok ? "done" : "failed"; m.end = new Date().toISOString(); writeMeta(id, m);
  await new Promise((res) => process.stdout.write(out + "\n", () => res()));
  return r.ok ? 0 : 1;
}

// ---------- subcommands ----------
function cmdCheckInstall() {
  const exe = findAgy();
  if (exe) { console.log(`INSTALLED: ${exe}`); return 0; }
  console.log("NOT_INSTALLED"); console.log(notInstalledHint()); return 0;
}
async function cmdInstall(confirmed) {
  const exe = findAgy();
  if (exe) { console.log(`agy is already installed at: ${exe}`); return 0; }
  if (!confirmed) { console.log("Refusing to install without confirmation. Would run:\n  " + officialInstallCmd() + "\nRe-run with --yes to proceed."); return 2; }
  try {
    if (IS_WIN) execSync(`powershell -NoProfile -Command "irm https://antigravity.google/cli/install.ps1 | iex"`, { stdio: "inherit" });
    else execSync(`curl -fsSL https://antigravity.google/cli/install.sh | bash`, { stdio: "inherit", shell: "/bin/bash" });
  } catch (e) { console.log(`\nInstaller failed: ${e.message}`); return 1; }
  const now = findAgy();
  if (now) { console.log(`\nagy installed at: ${now}\nNext: run \`agy\` once interactively to sign in, then /agy:setup.`); return 0; }
  console.log("\nInstaller finished but agy not found; restart terminal or set AGY_BIN."); return 1;
}
async function cmdSetup() {
  const exe = findAgy();
  console.log(`agy binary : ${exe || "NOT FOUND"}`);
  if (!exe) { console.log(notInstalledHint()); return 1; }
  console.log("node-pty   : checking (auto-installing if missing)...");
  const pty = await ensurePty();
  console.log(`node-pty   : ${pty ? "OK" : "UNAVAILABLE (auto-install failed; need npm + network)"}`);
  if (!pty) return 1;
  console.log("Probing agy through a synthesized console…");
  const r = await runAgy("Reply with exactly this token: AGY_READY", { readOnly: true, timeoutMs: 120_000 });
  if (r.ok && r.answer.includes("AGY_READY")) { console.log("RESULT: OK — agy is ready."); return 0; }
  if (r.ok) { console.log(`RESULT: agy answered unexpectedly: ${r.answer.slice(0, 120)}`); return 0; }
  console.log(`RESULT: ${r.error}`); return 1;
}
function cmdStatus() {
  ensureJobs();
  const metas = readdirSync(JOBS).filter((f) => f.endsWith(".meta.json"))
    .map((f) => { try { return { f, t: statSync(join(JOBS, f)).mtimeMs }; } catch { return null; } })
    .filter(Boolean).sort((a, b) => b.t - a.t).slice(0, 15);
  if (!metas.length) { console.log("(no agy jobs yet)"); return 0; }
  console.log("JOB ID                 KIND        STATUS     PROMPT");
  for (const { f } of metas) { let m; try { m = JSON.parse(readFileSync(join(JOBS, f), "utf8")); } catch { continue; }
    console.log(`${(m.id || "").padEnd(22)} ${(m.kind || "").padEnd(11)} ${(m.status || "").padEnd(10)} ${(m.prompt || "").slice(0, 46)}`); }
  return 0;
}
function cmdResult(rawId) {
  ensureJobs();
  let id = rawId ? safeJobId(rawId) : null;
  if (rawId && !id) { console.error(`Invalid job id: ${rawId}`); return 1; }
  if (!id) {
    const metas = readdirSync(JOBS).filter((f) => f.endsWith(".meta.json"))
      .map((f) => { try { return { id: f.replace(/\.meta\.json$/, ""), t: statSync(join(JOBS, f)).mtimeMs }; } catch { return null; } })
      .filter(Boolean).sort((a, b) => b.t - a.t);
    if (!metas.length) { console.log("(no agy jobs yet)"); return 0; }
    id = metas[0].id;
  }
  if (!existsSync(jobMeta(id))) { console.error(`No such job: ${id}`); return 1; }
  const m = readMeta(id);
  console.log(`JOB ${m.id} [${m.status}] (${m.kind})`);
  if (m.status === "running") { console.log("(still running)"); return 0; }
  console.log("----");
  console.log(existsSync(jobOut(id)) ? readFileSync(jobOut(id), "utf8") : "(no output)");
  return 0;
}
function killTree(pid) {
  if (!pid) return;
  try { if (IS_WIN) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" }); else process.kill(-pid, "SIGKILL"); } catch {}
}
function cmdCancel(rawId) {
  ensureJobs();
  const id = rawId ? safeJobId(rawId) : null;
  if (rawId && !id) { console.error(`Invalid job id: ${rawId}`); return 1; }
  let n = 0;
  for (const f of readdirSync(JOBS).filter((x) => x.endsWith(".meta.json"))) {
    let m; try { m = JSON.parse(readFileSync(join(JOBS, f), "utf8")); } catch { continue; }
    if (id && m.id !== id) continue;
    if (m.status !== "running") continue;
    if (m.pid) killTree(m.pid); else { m.cancelRequested = true; }
    m.status = "cancelled"; m.end = new Date().toISOString();
    writeFileSync(join(JOBS, f), JSON.stringify(m, null, 2), "utf8"); n++;
  }
  if (id && !n) { console.log(`Job ${id} not found or not running.`); return 0; }
  console.log(`Cancelled ${n} running job(s).`); return 0;
}

// ---------- arg parsing ----------
function parseFlags(rest) {
  const out = { writeOverride: null, yes: false, timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--write") out.writeOverride = true;
    else if (a === "--read-only" || a === "--readonly") out.writeOverride = false;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--timeout" && rest[i + 1]) { const s = parseInt(rest[++i], 10); if (Number.isFinite(s) && s > 0) out.timeoutMs = Math.min(Math.max(s * 1000, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS); }
  }
  return out;
}
function resolveReadOnly(def, ov) { return ov === true ? false : ov === false ? true : def; }

// ---------- main (guarded so tests can import) ----------
const isMain = (() => { try { return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href; } catch { return false; } })();

async function main() {
  const [, , sub, ...rest] = process.argv;
  const f = parseFlags(rest);
  const stdin = ["ask", "task", "rescue", "research", "review", "adversarial-review"].includes(sub) ? readStdin() : "";
  let code = 0;
  switch (sub) {
    case "ask": code = await runJob("ask", stdin, { readOnly: resolveReadOnly(true, f.writeOverride), timeoutMs: f.timeoutMs }); break;
    case "task": case "rescue": code = await runJob("task", `Do this task in the current project. You MAY edit files.\n\n${stdin}`, { readOnly: resolveReadOnly(false, f.writeOverride), timeoutMs: f.timeoutMs }); break;
    case "research": code = await runJob("research", `Research this and give a synthesized, well-structured answer:\n\n${stdin}`, { readOnly: resolveReadOnly(true, f.writeOverride), timeoutMs: f.timeoutMs }); break;
    case "review": { const { diff } = collectDiff(); code = await runJob("review", reviewPrompt(stdin, diff, false), { readOnly: true, timeoutMs: f.timeoutMs }); break; }
    case "adversarial-review": { const { diff } = collectDiff(); code = await runJob("adversarial-review", reviewPrompt(stdin, diff, true), { readOnly: true, timeoutMs: f.timeoutMs }); break; }
    case "setup": code = await cmdSetup(); break;
    case "check-install": code = cmdCheckInstall(); break;
    case "install": code = await cmdInstall(f.yes); break;
    case "status": code = cmdStatus(); break;
    case "result": code = cmdResult(rest[0]); break;
    case "cancel": code = cmdCancel(rest[0]); break;
    default: console.error(`Unknown subcommand: ${sub || "(none)"}\nValid: ask task research review adversarial-review setup check-install install status result cancel`); code = 2;
  }
  process.exitCode = code;
  // On Windows, node-pty/ConPTY leaves handles open after the child exits, so the event
  // loop never drains and the process would hang until the caller's timeout. We force-exit
  // once stdout is flushed. This also avoids node-pty's kill/console-list path, so there's
  // no benign-but-scary "AttachConsole failed" stack on stderr. All output above is awaited.
  process.stdout.write("", () => process.exit(code));
}
if (isMain) main();
