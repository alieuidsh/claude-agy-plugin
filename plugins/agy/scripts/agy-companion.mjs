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
  renameSync,
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

// ---------- model selection ----------
// agy has NO --model CLI flag; the model is read from settings.json's "model" field
// (verified: setting "Gemini 3.1 Pro (High)" → backend receives exactly that; an
// unknown label falls back to Flash). So to pick a model per-call we briefly rewrite
// settings.json, run, then restore it (serialized by a lock; see withModel()).
const BUILTIN_DEFAULT_MODEL = "Gemini 3.1 Pro (High)"; // strongest Pro, used if no user default set
// The default model is stored in the plugin's own config file (~/.agy-jobs/config.json),
// set via `/agy:model <name>` — takes effect immediately, persists across sessions, no
// terminal restart, survives plugin updates. Per-call `--model` always wins over it.
// Short aliases — GEMINI ONLY (per design). Claude/GPT-OSS models are real and appear
// in /agy:models, but must be passed by full label (cross-vendor behavior differs too
// much to alias casually). "pro"/"flash" intentionally map to whatever Gemini Pro/Flash
// label currently exists, resolved against the live model list at call time (so when
// 3.5 Pro ships, "pro" picks it up). The static map here is the fallback ordering.
// Each alias has `match` (against the live list, so it tracks the newest Gemini) AND a
// concrete `fallback` label used when the live list is unavailable (offline / first run /
// scrape failed). Every documented alias MUST have a fallback so it never degrades to a
// raw alias string (which the backend would silently fall back to Flash).
const GEMINI_ALIASES = [
  { aliases: ["pro", "pro-high"], match: /^Gemini .*Pro \(High\)$/i, fallback: "Gemini 3.1 Pro (High)" },
  { aliases: ["pro-low"], match: /^Gemini .*Pro \(Low\)$/i, fallback: "Gemini 3.1 Pro (Low)" },
  { aliases: ["pro-medium"], match: /^Gemini .*Pro \(Medium\)$/i, fallback: "Gemini 3.1 Pro (Medium)" },
  { aliases: ["flash", "flash-high"], match: /^Gemini .*Flash \(High\)$/i, fallback: "Gemini 3.5 Flash (High)" },
  { aliases: ["flash-medium"], match: /^Gemini .*Flash \(Medium\)$/i, fallback: "Gemini 3.5 Flash (Medium)" },
  { aliases: ["flash-low"], match: /^Gemini .*Flash \(Low\)$/i, fallback: "Gemini 3.5 Flash (Low)" },
];
function agyDir() { return join(HOME, ".gemini", "antigravity-cli"); }
function settingsFile() {
  if (process.env.AGY_SETTINGS && existsSync(process.env.AGY_SETTINGS)) return process.env.AGY_SETTINGS;
  const p = join(agyDir(), "settings.json");
  return existsSync(p) ? p : null;
}
// Map an alias to a full label. Gemini aliases resolve against the live model list
// (cached scrape) so "pro" tracks the newest Gemini Pro tier; anything else passes
// through unchanged (full labels, including Claude/GPT-OSS, and future models).
function aliasToLabel(s) {
  const raw = String(s).trim();
  const low = raw.toLowerCase();
  const rule = GEMINI_ALIASES.find((r) => r.aliases.includes(low));
  if (rule) {
    const live = cachedModelList();          // [] if unavailable
    const hit = live.find((m) => rule.match.test(m));
    if (hit) return hit;                      // newest live match (tracks new Gemini)
    return rule.fallback;                     // no live list → concrete label for THIS tier
  }
  return raw; // full label / unknown — pass through (backend falls back if invalid)
}
// ---------- plugin config (~/.agy-jobs/config.json): stores the user's default model ----
function configFile() { return join(JOBS, "config.json"); }
function readConfig() { try { return JSON.parse(readFileSync(configFile(), "utf8")) || {}; } catch { return {}; } }
function writeConfig(obj) { try { ensureJobs(); writeFileSync(configFile(), JSON.stringify(obj, null, 2), "utf8"); return true; } catch { return false; } }
// The effective default: the user's saved default (resolved through aliases), else builtin.
function defaultModel() {
  const saved = readConfig().defaultModel;
  if (saved && String(saved).trim()) return aliasToLabel(saved);
  return BUILTIN_DEFAULT_MODEL;
}
// ---------- live model list (scrape agy's interactive /model menu, cached) ----------
// agy has no CLI to print its model list, but the interactive `/model` menu lists every
// model the account can use (Gemini + Claude + GPT-OSS). We drive agy in a ConPTY, send
// /model, scrape the menu, then quit. Cached to ~/.agy-jobs/models-cache.json, keyed on
// agy version + exe fingerprint; re-scraped when those change or the cache is >7 days old.
const MODELS_CACHE = () => join(JOBS, "models-cache.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function agyVersion() {
  try {
    const exe = findAgy(); if (!exe) return null;
    const r = spawnSync(exe, ["--version"], { encoding: "utf8", timeout: 15_000 });
    const out = String(r.stdout || "").trim();
    const m = out.match(/\d+\.\d+\.\d+/);
    return m ? m[0] : (out || null);
  } catch { return null; }
}
// Fingerprint = exe size + mtime ONLY (no agyVersion). agy --version can be slow/null
// offline, which would change the fingerprint and force a re-scrape (then a 30s timeout)
// on every offline call. size+mtime already changes whenever the binary updates, and is
// instant + offline-safe.
function agyFingerprint() {
  const exe = findAgy(); if (!exe) return null;
  try { const st = statSync(exe); return `${st.size}|${Math.round(st.mtimeMs)}`; }
  catch { return null; }
}
function readModelsCache() {
  try { return JSON.parse(readFileSync(MODELS_CACHE(), "utf8")); } catch { return null; }
}
// Synchronous best-effort list for alias resolution (no scrape here — just the cache).
function cachedModelList() {
  const c = readModelsCache();
  return c && Array.isArray(c.models) ? c.models : [];
}
// POSITIVE extraction: match from the vendor word up to the first tier paren, so any
// trailing status-bar / cursor text (even separated by a single space) is dropped
// instead of contaminating or invalidating the label. `.*?` is lazy so it stops at the
// FIRST "(tier)" — robust to "(current)" and one-space status bleed (3-way review #6).
function parseModelMenu(rawClean) {
  const out = [];
  const re = /(?:Gemini|Claude|GPT-OSS|GPT|GLM|Llama|Mistral|Qwen|DeepSeek)\b.*?\((?:High|Medium|Low|Thinking|Standard)\)/i;
  for (const line of rawClean.split("\n")) {
    const m = line.replace(/\r/g, "").match(re);
    if (m && m[0].length < 60) out.push(m[0].trim());
  }
  return [...new Set(out)];
}
// Drive interactive agy, scrape /model. Returns array of labels (possibly empty).
async function scrapeModelList({ timeoutMs = 30_000 } = {}) {
  const exe = findAgy(); if (!exe) return [];
  const pty = await ensurePty(); if (!pty) return [];
  // Pick an already-trusted workspace so the trust prompt is skipped.
  let cwd = IS_WIN ? (process.env.TEMP || HOME) : HOME;
  try {
    const sf = settingsFile();
    if (sf) { const tw = JSON.parse(readFileSync(sf, "utf8")).trustedWorkspaces; if (Array.isArray(tw) && tw[0] && existsSync(tw[0])) cwd = tw[0]; }
  } catch {}
  return await new Promise((resolve) => {
    let buf = "", settled = false, sentModel = false, sawMenu = false, resolved = false;
    const child = pty.spawn(exe, [], { name: "xterm-256color", cols: 120, rows: 50, cwd, env: process.env });
    const pid = child.pid;
    const strip = (s) => cleanOutput(s);
    const giveResult = () => { if (resolved) return; resolved = true; resolve(parseModelMenu(strip(buf))); };
    // Resolve with the parsed list, then quit agy. We kill the OS process tree directly
    // (taskkill / SIGKILL) instead of child.kill(), because node-pty's kill path spawns a
    // console-list helper that throws a noisy "AttachConsole failed" in a headless shell.
    const fin = () => {
      if (settled) return; settled = true;
      giveResult();
      try { child.write("\x1b"); child.write("/quit\r"); } catch {} // ask agy to exit cleanly
      setTimeout(() => {
        if (!pid) return;
        try { if (IS_WIN) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" }); else process.kill(pid, "SIGKILL"); } catch {}
      }, 300);
    };
    child.onData((d) => {
      buf += d;
      const c = strip(buf);
      if (!sentModel && /trust (this|the contents)/i.test(c) && /Yes, I trust/i.test(c)) { try { child.write("\r"); } catch {} }
      if (!sentModel && /\? for shortcuts/.test(c)) { sentModel = true; setTimeout(() => { try { child.write("/model\r"); } catch {} }, 800); }
      if (sentModel && /Switch Model/i.test(c) && !sawMenu) { sawMenu = true; setTimeout(fin, 1500); } // menu rendered — grab & go
    });
    child.onExit(() => { giveResult(); settled = true; });
    const t = setTimeout(fin, timeoutMs); if (t.unref) t.unref();
  });
}
// Get the model list, using cache unless stale/forced. force=true always re-scrapes.
async function getModelList({ force = false } = {}) {
  const fp = agyFingerprint();
  const cache = readModelsCache();
  const fresh = cache && cache.fingerprint === fp && Array.isArray(cache.models) && cache.models.length &&
    cache.scrapedAt && (nowMs() - Date.parse(cache.scrapedAt) < CACHE_TTL_MS);
  if (!force && fresh) return { models: cache.models, cached: true, version: cache.version || null };
  const models = await scrapeModelList();
  if (models.length) {
    try { ensureJobs(); writeFileSync(MODELS_CACHE(), JSON.stringify({ fingerprint: fp, version: agyVersion(), models, scrapedAt: isoNow() }, null, 2), "utf8"); } catch {}
    return { models, cached: false, version: agyVersion() };
  }
  // Scrape failed — fall back to stale cache if we have one.
  if (cache && Array.isArray(cache.models) && cache.models.length) return { models: cache.models, cached: true, stale: true, version: cache.version || null };
  return { models: [], cached: false, version: agyVersion() };
}
// nowMs/isoNow isolated so the no-Date-in-workflows rule is irrelevant here (plain CLI).
function nowMs() { return Date.now(); }
function isoNow() { return new Date().toISOString(); }

// Resolve an alias / full label / undefined into a concrete label.
function resolveModel(input) {
  if (!input || !String(input).trim()) return defaultModel();
  return aliasToLabel(input);
}
// Read the model agy actually propagated to the backend, from cli.log (ground truth,
// not the model's self-report). Lets us tell the user if their pick fell back.
function readActualModel() {
  try {
    const log = join(agyDir(), "cli.log");
    if (!existsSync(log)) return null;
    const txt = readFileSync(log, "utf8");
    const re = /Propagating selected model override to backend: label="([^"]*)"/g;
    let m, last = null;
    while ((m = re.exec(txt)) !== null) last = m[1];
    return last;
  } catch { return null; }
}

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

// Exported for unit tests (parseModelMenu is internal but testable via this alias).
export const __parseModelMenu = (s) => parseModelMenu(s);

// Atomic JSON write: write to a temp file then rename, so a crash mid-write can't leave
// the file half-written. The WHOLE operation is guarded, and the temp file is always
// cleaned up on any failure (no .tmp litter).
function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp.${process.pid}.${Math.floor(Math.random() * 1e6)}`;
  try {
    writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
    renameSync(tmp, file);
  } catch (e) { try { unlinkSync(tmp); } catch {}; throw e; }
}
// Set settings.json's "model" key (or delete it if value===undefined), atomically,
// preserving the rest of the file. Returns true on success, false on failure.
function setSettingsModel(sf, value) {
  try {
    let cur; try { cur = JSON.parse(readFileSync(sf, "utf8")); } catch { cur = {}; }
    if (!cur || typeof cur !== "object") cur = {};
    if (value === undefined) delete cur.model; else cur.model = value;
    writeJsonAtomic(sf, cur);
    return true;
  } catch { return false; }
}

// Run fn() with settings.json's "model" temporarily set to targetLabel, then restore the
// ORIGINAL. CRASH-SAFE design (from two rounds of 3-way review):
//  - All settings.json reads/writes happen ONLY while holding the lock (no concurrent
//    job can ever snapshot another's temporary value as "original").
//  - Before changing settings.json we PERSIST the original into the lock dir
//    (restore.json). So if this process is killed mid-run, the next run that finds the
//    (now stale) lock RESTORES the user's real model from restore.json before evicting
//    the lock — settings.json is never left pinned to a temporary model.
//  - If we can't get the lock, we DON'T touch settings.json (run degraded, never corrupt).
//  - If a write fails, we degrade (run with current model) instead of crashing.
//  - If RESTORE fails, we DON'T release the lock and we report it — the durable
//    restore.json lets a later run recover, rather than silently leaving a wrong model.
//  - Heartbeat refreshes a FILE inside the lock dir (not the dir mtime, which utimesSync
//    can't reliably touch on Windows); stale detection reads that file's mtime.
const MODEL_LOCK_STALE_MS = 30 * 60 * 1000;
function lockBeatFile(lock) { return join(lock, "beat"); }
function lockRestoreFile(lock) { return join(lock, "restore.json"); }
function lockFreshMs(lock) {
  // Most-recent of the beat file and the lock dir itself.
  let t = 0;
  try { t = Math.max(t, statSync(lockBeatFile(lock)).mtimeMs); } catch {}
  try { t = Math.max(t, statSync(lock).mtimeMs); } catch {}
  return t;
}
// If `lock` holds a restore.json (a crashed owner left it), put the user's real model
// back BEFORE we reuse the lock. Best-effort: only proceeds if we can read the snapshot.
function recoverFromStaleLock(sf, lock) {
  try {
    const snap = JSON.parse(readFileSync(lockRestoreFile(lock), "utf8"));
    if (snap && snap.changed) setSettingsModel(sf, snap.original); // original may be undefined → delete
  } catch { /* no/unreadable snapshot — nothing to recover */ }
}
async function withModel(targetLabel, fn) {
  const sf = settingsFile();
  if (!sf) return await fn(); // no settings file — use agy's current default
  const lock = join(agyDir(), ".agy-model.lock");
  let locked = false;
  for (let i = 0; i < 600; i++) { // up to ~10 min waiting for a busy lock
    try { if (Date.now() - lockFreshMs(lock) > MODEL_LOCK_STALE_MS) { recoverFromStaleLock(sf, lock); try { unlinkSync(lockBeatFile(lock)); } catch {} try { unlinkSync(lockRestoreFile(lock)); } catch {} rmdirSync(lock); } } catch {}
    try { mkdirSync(lock); locked = true; break; } catch { await _sleep(1000); }
  }
  if (!locked) {
    process.stderr.write("[agy] note: could not lock settings.json; running with the current model (another agy job is active).\n");
    return await fn();
  }
  const beat = () => { try { writeFileSync(lockBeatFile(lock), String(Date.now()), "utf8"); } catch {} };
  beat();
  const heartbeat = setInterval(beat, 60_000);
  if (heartbeat.unref) heartbeat.unref();
  let original;
  let changed = false;
  try {
    let cur; try { cur = JSON.parse(readFileSync(sf, "utf8")); } catch { cur = null; }
    if (cur && typeof cur === "object") {
      original = Object.prototype.hasOwnProperty.call(cur, "model") ? cur.model : undefined;
      if (original !== targetLabel) {
        // Persist the restore snapshot BEFORE changing settings (durable across a crash).
        try { writeJsonAtomic(lockRestoreFile(lock), { original, changed: true }); } catch {}
        if (setSettingsModel(sf, targetLabel)) changed = true;
        else process.stderr.write("[agy] note: could not write settings.json; running with the current model.\n");
      }
    }
    return await fn();
  } finally {
    clearInterval(heartbeat);
    let restored = true;
    if (changed) {
      restored = setSettingsModel(sf, original);
      if (!restored) process.stderr.write("[agy] WARNING: failed to restore your settings.json model; it may be left on \"" + targetLabel + "\". Re-run /agy:model to reset, or check ~/.gemini/antigravity-cli/settings.json.\n");
    }
    if (restored) {
      // Clean shutdown: drop the snapshot + lock.
      try { unlinkSync(lockBeatFile(lock)); } catch {}
      try { unlinkSync(lockRestoreFile(lock)); } catch {}
      try { rmdirSync(lock); } catch {}
    }
    // If NOT restored: deliberately keep the lock + restore.json so a later run recovers.
  }
}

// ---------- run agy inside a ConPTY and capture the answer ----------
async function runAgy(prompt, { readOnly = false, timeoutMs = DEFAULT_TIMEOUT_MS, onSpawn, model } = {}) {
  const exe = findAgy();
  if (!exe) return { ok: false, error: "agy CLI not installed. Run /agy:install (asks first), or install manually: " + officialInstallCmd() };
  const pty = await ensurePty();
  if (!pty) return { ok: false, error: "node-pty unavailable and auto-install failed. Ensure Node.js/npm are installed and you have network, then run /agy:setup. (v2 needs a synthesized console to drive agy.)" };
  const targetModel = resolveModel(model);

  // Read-only modes run agy with --sandbox (terminal restrictions): verified it still
  // lets agy read/analyze files, but blocks system/terminal side-effects. Write modes
  // pass --dangerously-skip-permissions so agy can edit without an (impossible-in-print) prompt.
  const args = [];
  if (readOnly) args.push("--sandbox");
  else args.push("--dangerously-skip-permissions");
  args.push("--print", prompt);

  const result = await withModel(targetModel, () => new Promise((resolve) => {
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
  }));
  if (result && result.ok) result.model = readActualModel() || targetModel;
  return result;
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
async function runJob(kind, prompt, { readOnly, timeoutMs, model }) {
  ensureJobs();
  const id = newJobId();
  const requested = resolveModel(model);
  writeMeta(id, { id, kind, status: "running", model: requested, prompt: prompt.replace(/\s+/g, " ").slice(0, 200), pid: null, start: new Date().toISOString(), end: null });
  process.stderr.write(`[agy] job ${id} (${kind}) started [model: ${requested}]\n`);
  const r = await runAgy(prompt, { readOnly, timeoutMs, model, onSpawn: (pid) => { try { const m = readMeta(id); m.pid = pid; writeMeta(id, m); } catch {} } });
  const out = r.ok ? r.answer : `ERROR: ${r.error}`;
  writeFileSync(jobOut(id), out, "utf8");
  const m = readMeta(id); m.status = r.ok ? "done" : "failed"; m.actualModel = r.ok ? (r.model || null) : null; m.end = new Date().toISOString(); writeMeta(id, m);
  if (r.ok && r.model) process.stderr.write(`[agy] answered with model: ${r.model}\n`);
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
function aliasHintFor(label) {
  const r = GEMINI_ALIASES.find((g) => g.match.test(label));
  return r ? `  (alias: ${r.aliases.join(", ")})` : "";
}
async function cmdModels({ refresh = false } = {}) {
  const saved = readConfig().defaultModel;
  const src = saved ? "set via /agy:model" : "built-in";
  console.log(`Default model (used when --model is omitted): ${defaultModel()}  [${src}]`);
  console.log("");

  // Live list, cached on agy version+fingerprint (re-scraped on change or >7 days).
  const cacheBefore = readModelsCache();
  if (!refresh && !(cacheBefore && cacheBefore.fingerprint === agyFingerprint() && Array.isArray(cacheBefore.models) && cacheBefore.models.length)) {
    process.stderr.write("[agy] scraping the live /model list (one-time, ~15-20s; cached after)…\n");
  } else if (refresh) {
    process.stderr.write("[agy] --refresh: re-scraping the live /model list…\n");
  }
  const { models, cached, stale, version } = await getModelList({ force: refresh });

  if (models.length) {
    console.log(`Available models for your account${version ? ` (agy ${version})` : ""}${cached ? (stale ? " [cached, stale]" : " [cached]") : " [freshly scraped]"}:`);
    for (const m of models) console.log(`  ${m}${aliasHintFor(m)}`);
  } else {
    console.log("Available models: (could not read the live list — using fallbacks)");
    console.log("  Gemini 3.1 Pro (High)   (alias: pro, pro-high)");
    console.log("  Gemini 3.5 Flash (High) (alias: flash, flash-high)");
    console.log("  Tip: run `/agy:models --refresh`, or `agy` once interactively to sign in.");
  }
  console.log("");
  console.log("Pick per call with --model <alias|full label>, e.g.:");
  console.log("  /agy:ask --model flash …                       (Gemini alias)");
  console.log("  /agy:ask --model \"Claude Opus 4.6 (Thinking)\" …  (full label for non-Gemini)");
  console.log("Aliases are Gemini-only (pro/flash + tiers); Claude/GPT-OSS need the full label.");
  console.log("");
  console.log("Set the DEFAULT permanently:  /agy:model <alias|label>");
  console.log("  e.g.  /agy:model flash   or   /agy:model \"Claude Opus 4.6 (Thinking)\"");
  console.log("See/refresh: `/agy:model` shows the current default; `/agy:models --refresh`");
  console.log("re-scrapes this list (also auto-re-scrapes when agy updates — see /agy:update).");
  return 0;
}
// /agy:model           -> show the current default
// /agy:model <name>    -> set the default (saved to plugin config, persistent)
function cmdModel(arg) {
  if (!arg || !String(arg).trim()) {
    const saved = readConfig().defaultModel;
    console.log(`Current default model: ${defaultModel()}  [${saved ? "set via /agy:model" : "built-in"}]`);
    console.log("Change it:  /agy:model <alias|label>   e.g.  /agy:model flash");
    console.log("See all options:  /agy:models");
    return 0;
  }
  const requested = String(arg).trim();
  const resolved = aliasToLabel(requested);
  const cfg = readConfig();
  cfg.defaultModel = requested; // store as given (alias stays dynamic; label stays exact)
  if (!writeConfig(cfg)) { console.error("Failed to save default model to plugin config."); return 1; }
  console.log(`Default model set to: ${resolved}`);
  if (resolved !== requested) console.log(`  (alias "${requested}" → ${resolved}; tracks the live list)`);
  // Gentle nudge if it's not in the known live list (might be a typo / not yet released).
  const live = cachedModelList();
  if (live.length && !live.includes(resolved) && !GEMINI_ALIASES.some((g) => g.aliases.includes(requested.toLowerCase()))) {
    console.log(`  Note: "${resolved}" isn't in your current model list (/agy:models). It will`);
    console.log(`  fall back to a Flash tier until available. Each run reports the model used.`);
  }
  console.log("Takes effect immediately; per-call --model still overrides it.");
  return 0;
}
async function cmdUpdate() {
  const exe = findAgy();
  if (!exe) { console.log(notInstalledHint()); return 1; }
  const before = agyVersion();
  console.log(`Updating agy (current: ${before || "?"})… running \`agy update\`.`);
  try {
    const r = spawnSync(exe, ["update"], { encoding: "utf8", timeout: 300_000, stdio: "inherit" });
    if (r.status !== 0 && r.status != null) console.log(`(agy update exited ${r.status})`);
  } catch (e) { console.log(`agy update failed: ${e.message}`); return 1; }
  const after = agyVersion();
  console.log(`\nagy version: ${before || "?"} -> ${after || "?"}`);
  if (after && before && after !== before) {
    // Version changed → invalidate the model cache so /agy:models re-scrapes next time.
    try { if (existsSync(MODELS_CACHE())) unlinkSync(MODELS_CACHE()); } catch {}
    console.log("Model list cache cleared; /agy:models will re-scrape on next run.");
  } else {
    console.log("No version change (or unknown). Use `/agy:models --refresh` to force a re-scrape.");
  }
  return 0;
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
  const out = { writeOverride: null, yes: false, timeoutMs: DEFAULT_TIMEOUT_MS, model: undefined, refresh: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--write") out.writeOverride = true;
    else if (a === "--read-only" || a === "--readonly") out.writeOverride = false;
    else if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--refresh") out.refresh = true;
    else if (a === "--timeout" && rest[i + 1]) { const s = parseInt(rest[++i], 10); if (Number.isFinite(s) && s > 0) out.timeoutMs = Math.min(Math.max(s * 1000, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS); }
    else if (a === "--model" && rest[i + 1]) { out.model = rest[++i]; }
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
    case "ask": code = await runJob("ask", stdin, { readOnly: resolveReadOnly(true, f.writeOverride), timeoutMs: f.timeoutMs, model: f.model }); break;
    case "task": case "rescue": code = await runJob("task", `Do this task in the current project. You MAY edit files.\n\n${stdin}`, { readOnly: resolveReadOnly(false, f.writeOverride), timeoutMs: f.timeoutMs, model: f.model }); break;
    case "research": code = await runJob("research", `Research this and give a synthesized, well-structured answer:\n\n${stdin}`, { readOnly: resolveReadOnly(true, f.writeOverride), timeoutMs: f.timeoutMs, model: f.model }); break;
    case "review": { const { diff } = collectDiff(); code = await runJob("review", reviewPrompt(stdin, diff, false), { readOnly: true, timeoutMs: f.timeoutMs, model: f.model }); break; }
    case "adversarial-review": { const { diff } = collectDiff(); code = await runJob("adversarial-review", reviewPrompt(stdin, diff, true), { readOnly: true, timeoutMs: f.timeoutMs, model: f.model }); break; }
    case "setup": code = await cmdSetup(); break;
    case "model": { const a = f.model || rest.filter((x) => !x.startsWith("--")).join(" ").trim(); code = cmdModel(a); break; }
    case "models": code = await cmdModels({ refresh: f.refresh }); break;
    case "update": code = await cmdUpdate(); break;
    case "check-install": code = cmdCheckInstall(); break;
    case "install": code = await cmdInstall(f.yes); break;
    case "status": code = cmdStatus(); break;
    case "result": code = cmdResult(rest[0]); break;
    case "cancel": code = cmdCancel(rest[0]); break;
    default: console.error(`Unknown subcommand: ${sub || "(none)"}\nValid: ask task research review adversarial-review setup models update check-install install status result cancel`); code = 2;
  }
  process.exitCode = code;
  // On Windows, node-pty/ConPTY leaves handles open after the child exits, so the event
  // loop never drains and the process would hang until the caller's timeout. We force-exit
  // once stdout is flushed. This also avoids node-pty's kill/console-list path, so there's
  // no benign-but-scary "AttachConsole failed" stack on stderr. All output above is awaited.
  process.stdout.write("", () => process.exit(code));
}
if (isMain) main();
