#!/usr/bin/env node
// agy-companion.mjs — cross-platform runtime for the agy (Google Antigravity /
// Gemini) Claude Code plugin. The agy analogue of codex-companion.mjs.
//
// Works on Windows + Linux + macOS. Subcommands:
//   ask                 one-shot question, prints answer
//   task | rescue       delegate work (agy may write files)
//   research            research-framed question
//   review              review the local git diff (READ-ONLY)
//   adversarial-review  adversarial review of the local git diff (READ-ONLY)
//   setup               health-check: is agy installed + authed?
//   status              list recent jobs
//   result [id]         print a job's stored answer
//   cancel [id]         kill a job's agy process + mark it cancelled
//
// The user's prompt text is read from STDIN (never the shell command line) to
// eliminate shell-injection via $ARGUMENTS. Flags come from argv.
//
// Job metadata lives under ~/.agy-jobs so status/result/cancel work across
// separate Claude background tasks.
//
// KEY agy QUIRKS handled here:
//  1. `agy --print` writes its answer to the TTY, not stdout — we read it back
//     from the transcript agy persists under ~/.gemini/antigravity-cli/brain.
//  2. `--print` is a value flag (alias of --prompt): it consumes the NEXT arg as
//     the prompt. So boolean flags go FIRST and `--print <prompt>` goes LAST.
//  3. agy may split a long answer across MANY PLANNER_RESPONSE entries; we join
//     all of this run's entries (correlated by a per-job nonce), not just one.

import { spawn } from "node:child_process";
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const HOME = homedir();
const IS_WIN = platform() === "win32";
const BRAIN = join(HOME, ".gemini", "antigravity-cli", "brain");
const JOBS = join(HOME, ".agy-jobs");
const DEFAULT_TIMEOUT_MS = 300_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 1_800_000; // 30 min hard ceiling
const JOB_ID_RE = /^\d{8}_\d{6}_\d{4}$/; // matches newJobId() output

// ---------- locate the agy binary (cross-platform) ----------
function findAgy() {
  if (process.env.AGY_BIN && existsSync(process.env.AGY_BIN)) return process.env.AGY_BIN;
  const candidates = [];
  if (IS_WIN) {
    const la = process.env.LOCALAPPDATA || join(HOME, "AppData", "Local");
    candidates.push(join(la, "agy", "bin", "agy.exe"));
  } else {
    candidates.push(join(HOME, ".agy", "bin", "agy"));
    candidates.push("/usr/local/bin/agy");
    candidates.push("/usr/bin/agy");
  }
  for (const c of candidates) if (existsSync(c)) return c;
  // Fall back to PATH lookup. Prefer a real executable, not a .cmd/.bat shim
  // (spawn with shell:false can't run those).
  try {
    const cmd = IS_WIN ? "where agy" : "command -v agy";
    const lines = execSync(cmd, { encoding: "utf8" }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const exe = lines.find((p) => /\.exe$/i.test(p)) || lines[0];
    if (exe && existsSync(exe)) return exe;
  } catch { /* not on PATH */ }
  return null;
}

// ---------- run agy headless, return the model's answer ----------
// opts.readOnly => do NOT pass --dangerously-skip-permissions, no writable dir.
// A per-run nonce is embedded in the prompt so extractAnswer() can correlate the
// transcript to THIS run (prevents picking another concurrent job's answer).
function runAgy(prompt, { workdir = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS, readOnly = false, nonce } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const exe = findAgy();
    if (!exe) {
      done({ ok: false, error: "agy binary not found. Set AGY_BIN or install Antigravity CLI." });
      return;
    }
    const startedAt = Date.now();
    const taggedPrompt = nonce ? `[run:${nonce}]\n${prompt}` : prompt;

    // CRITICAL ARG ORDER: boolean flags first; --print <prompt> LAST.
    const args = [];
    if (!readOnly) args.push("--dangerously-skip-permissions");
    if (workdir) args.push("--add-dir", workdir);
    args.push("--print", taggedPrompt);

    let child;
    try {
      child = spawn(exe, args, {
        stdio: ["ignore", "ignore", "pipe"], // answer via transcript; keep stderr for diagnostics
        windowsHide: true,
        detached: !IS_WIN,
      });
    } catch (e) {
      done({ ok: false, error: `failed to spawn agy: ${e.message}` });
      return;
    }

    let stderr = "";
    if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });

    const finishFromTranscript = (exitInfo) => {
      // Give agy a beat to flush the transcript, then extract THIS run's answer.
      setTimeout(() => {
        let answer = null;
        try { answer = extractAnswer(startedAt - 3000, nonce); } catch (e) {
          done({ ok: false, error: `failed to read agy transcript: ${e.message}` });
          return;
        }
        if (answer == null) {
          const hint = stderr.trim() ? ` agy stderr: ${stderr.trim().slice(0, 300)}` : "";
          done({ ok: false, error: `agy produced no matching response${exitInfo ? ` (${exitInfo})` : ""}.${hint}` });
        } else {
          done({ ok: true, answer });
        }
      }, 1200);
    };

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
      // Resolve independently after a grace period even if 'exit' never fires.
      setTimeout(() => {
        if (settled) return;
        done({ ok: false, error: `agy timed out after ${Math.round(timeoutMs / 1000)}s. Run \`agy\` once interactively to re-auth if this persists.` });
      }, 2500);
    }, timeoutMs);

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        done({ ok: false, error: `agy timed out after ${Math.round(timeoutMs / 1000)}s.` });
        return;
      }
      finishFromTranscript(signal ? `signal ${signal}` : (code ? `exit ${code}` : ""));
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      done({ ok: false, error: `failed to spawn agy: ${e.message}` });
    });

    // expose pid for the caller to persist (for targeted cancel)
    runAgy._lastPid = child.pid;
  });
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (IS_WIN) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch { /* already gone */ }
  // agy spawns a helper that can linger (Windows only).
  if (IS_WIN) {
    try { execSync(`taskkill /F /IM webm_encoder.exe /T`, { stdio: "ignore" }); } catch { /* none */ }
  }
}

// ---------- read agy's answer from this run's transcript ----------
// If a nonce is given, ONLY accept transcripts whose USER_INPUT contains it, and
// join ALL of that session's MODEL responses in created_at order (agy chunks long
// answers). Without a nonce, fall back to the newest single response since `sinceMs`.
function extractAnswer(sinceMs, nonce) {
  if (!existsSync(BRAIN)) return null;
  const files = [];
  const stack = [BRAIN];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { stack.push(full); continue; }
      if (e.name !== "transcript.jsonl") continue;
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.mtimeMs < sinceMs) continue;
      files.push(full);
    }
  }

  if (nonce) {
    // Find the transcript file whose user input carries our nonce.
    for (const f of files) {
      let rows;
      try { rows = parseJsonl(f); } catch { continue; }
      const mine = rows.some(
        (o) => o.type === "USER_INPUT" && typeof o.content === "string" && o.content.includes(nonce),
      );
      if (!mine) continue;
      const segs = rows
        .filter((o) => o.type === "PLANNER_RESPONSE" && o.source === "MODEL" && o.content)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((o) => o.content.trim())
        .filter(Boolean);
      if (segs.length) return segs.join("\n\n");
    }
    return null; // nonce given but no matching transcript → don't return a stale answer
  }

  // No nonce: newest single MODEL response across recent transcripts.
  let best = null, bestTs = "";
  for (const f of files) {
    let rows;
    try { rows = parseJsonl(f); } catch { continue; }
    for (const o of rows) {
      if (o.type === "PLANNER_RESPONSE" && o.source === "MODEL" && o.content) {
        const ts = String(o.created_at || "");
        if (ts >= bestTs) { best = o.content; bestTs = ts; }
      }
    }
  }
  return best;
}

function parseJsonl(file) {
  const out = [];
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip bad line */ }
  }
  return out;
}

// ---------- job metadata ----------
function ensureJobs() {
  try {
    if (existsSync(JOBS)) {
      if (!statSync(JOBS).isDirectory()) {
        console.error(`[agy] ${JOBS} exists but is not a directory.`);
        process.exit(1);
      }
    } else {
      mkdirSync(JOBS, { recursive: true });
    }
  } catch (e) {
    console.error(`[agy] cannot initialize jobs dir: ${e.message}`);
    process.exit(1);
  }
}
function safeJobId(id) {
  if (!id || !JOB_ID_RE.test(id)) return null;
  return id;
}
function jobMetaPath(id) { return join(JOBS, `${id}.meta.json`); }
function jobOutPath(id) { return join(JOBS, `${id}.out.txt`); }
function newJobId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_${Math.floor(Math.random() * 9000 + 1000)}`;
}
function writeMeta(id, m) { writeFileSync(jobMetaPath(id), JSON.stringify(m, null, 2), "utf8"); }
function readMeta(id) { return JSON.parse(readFileSync(jobMetaPath(id), "utf8")); }

// ---------- git helpers (for review commands) ----------
function git(args) {
  try { return execSync(`git ${args}`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }); }
  catch { return ""; }
}
function collectDiff() {
  const status = git("status --short --untracked-files=all");
  const staged = git("diff --cached");
  const unstaged = git("diff");
  return { status, diff: (staged + "\n" + unstaged).trim() };
}

// ---------- prompt builders ----------
function reviewPrompt(focus, diff, adversarial) {
  const role = adversarial
    ? "You are a ruthless adversarial senior code reviewer. Actively try to BREAK this change: hunt for bugs, security holes, race conditions, edge cases, and bad design tradeoffs. Question whether the whole approach is even correct."
    : "You are a careful senior code reviewer. Find correctness bugs, risky edge cases, and clear improvements.";
  return `${role}
Review ONLY the diff below. Do NOT modify files — this is review-only.
List findings most-severe first, each with file:line and a concrete fix.
${focus ? `Extra focus from the user: ${focus}\n` : ""}
=== DIFF ===
${diff || "(no diff detected)"}`;
}

// ---------- read the user's prompt from stdin (injection-safe) ----------
function readStdin() {
  try {
    const data = readFileSync(0, "utf8"); // fd 0
    return data.replace(/\r\n/g, "\n").trim();
  } catch { return ""; }
}

// ---------- run + record a job ----------
async function runJob(kind, prompt, { workdir, timeoutMs, readOnly = false } = {}) {
  ensureJobs();
  const id = newJobId();
  const nonce = `agy-${id}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  const promptPreview = prompt.replace(/\s+/g, " ").slice(0, 200);
  writeMeta(id, { id, kind, status: "running", prompt: promptPreview, pid: null, start: new Date().toISOString(), end: null });
  process.stderr.write(`[agy] job ${id} (${kind}) started\n`);

  const r = await runAgy(prompt, { workdir, timeoutMs, readOnly, nonce });

  // persist pid (best-effort) for targeted cancel
  const m0 = readMeta(id);
  m0.pid = runAgy._lastPid || null;
  writeMeta(id, m0);

  const out = r.ok ? r.answer : `ERROR: ${r.error}`;
  writeFileSync(jobOutPath(id), out, "utf8");
  const m = readMeta(id);
  m.status = r.ok ? "done" : "failed";
  m.end = new Date().toISOString();
  writeMeta(id, m);

  // Print the answer to stdout (clean UTF-8). Use a callback to ensure the write
  // flushes before we exit (process.exit can truncate a pending pipe write).
  await new Promise((res) => process.stdout.write(out + "\n", () => res()));
  return r.ok ? 0 : 1;
}

// ---------- subcommands: status / result / cancel / setup ----------
function cmdStatus() {
  ensureJobs();
  const metas = readdirSync(JOBS).filter((f) => f.endsWith(".meta.json"))
    .map((f) => ({ f, t: statSync(join(JOBS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t).slice(0, 15);
  if (!metas.length) { console.log("(no agy jobs yet)"); return 0; }
  console.log("JOB ID                 KIND        STATUS     PROMPT");
  for (const { f } of metas) {
    let m; try { m = JSON.parse(readFileSync(join(JOBS, f), "utf8")); } catch { continue; }
    const p = (m.prompt || "").slice(0, 46);
    console.log(`${(m.id || "").padEnd(22)} ${(m.kind || "").padEnd(11)} ${(m.status || "").padEnd(10)} ${p}`);
  }
  return 0;
}
function cmdResult(rawId) {
  ensureJobs();
  let id = rawId ? safeJobId(rawId) : null;
  if (rawId && !id) { console.error(`Invalid job id: ${rawId}`); return 1; }
  if (!id) {
    const metas = readdirSync(JOBS).filter((f) => f.endsWith(".meta.json"))
      .map((f) => ({ id: f.replace(/\.meta\.json$/, ""), t: statSync(join(JOBS, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!metas.length) { console.log("(no agy jobs yet)"); return 0; }
    id = metas[0].id;
  }
  if (!existsSync(jobMetaPath(id))) { console.error(`No such job: ${id}`); return 1; }
  const m = readMeta(id);
  console.log(`JOB ${m.id} [${m.status}] (${m.kind})`);
  if (m.status === "running") { console.log("(still running — no output yet)"); return 0; }
  console.log("----");
  console.log(existsSync(jobOutPath(id)) ? readFileSync(jobOutPath(id), "utf8") : "(no output file)");
  return 0;
}
function cmdCancel(rawId) {
  ensureJobs();
  const id = rawId ? safeJobId(rawId) : null;
  if (rawId && !id) { console.error(`Invalid job id: ${rawId}`); return 1; }

  let n = 0;
  const files = readdirSync(JOBS).filter((x) => x.endsWith(".meta.json"));
  for (const f of files) {
    let m; try { m = JSON.parse(readFileSync(join(JOBS, f), "utf8")); } catch { continue; }
    if (id && m.id !== id) continue;
    if (m.status !== "running") continue;
    if (m.pid) killTree(m.pid);   // targeted: only THIS job's process tree
    m.status = "cancelled"; m.end = new Date().toISOString();
    writeFileSync(join(JOBS, f), JSON.stringify(m, null, 2), "utf8");
    n++;
  }
  if (id && n === 0) { console.log(`Job ${id} not found or not running.`); return 0; }
  console.log(`Cancelled ${n} running job(s) by PID.`);
  return 0;
}
async function cmdSetup() {
  const exe = findAgy();
  console.log(`agy binary: ${exe || "NOT FOUND"}`);
  if (!exe) { console.log("Install Antigravity CLI, or set AGY_BIN to the agy executable path."); return 1; }
  console.log(`brain dir : ${existsSync(BRAIN) ? BRAIN : "(missing — agy never run?)"}`);
  console.log("Probing agy (auth + answer capture)…");
  const nonce = `setup-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const r = await runAgy("Reply with exactly this token: AGY_READY", { workdir: "", timeoutMs: 120_000, readOnly: true, nonce });
  if (r.ok && r.answer.includes("AGY_READY")) { console.log("RESULT: ✅ agy is ready."); return 0; }
  if (r.ok) { console.log(`RESULT: ⚠️ agy answered but unexpected: ${r.answer.slice(0, 120)}`); return 0; }
  console.log(`RESULT: ❌ ${r.error}`);
  console.log("If this is an auth error, run `agy` once interactively to sign in.");
  return 1;
}

// ---------- arg parsing (flags only; prompt comes from stdin) ----------
// `writeOverride`: null = use the subcommand's safe default; true = --write forces
// write-capable; false = --read-only forces read-only. Mirrors codex's model of a
// safe default that the user can explicitly override.
function parseFlags(rest) {
  const out = { background: false, wait: false, timeoutMs: DEFAULT_TIMEOUT_MS, writeOverride: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--background") out.background = true;
    else if (a === "--wait") out.wait = true;
    else if (a === "--write") out.writeOverride = true;
    else if (a === "--read-only" || a === "--readonly") out.writeOverride = false;
    else if (a === "--timeout" && rest[i + 1]) {
      const secs = parseInt(rest[++i], 10);
      if (Number.isFinite(secs) && secs > 0) {
        out.timeoutMs = Math.min(Math.max(secs * 1000, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
      }
    }
    // any other tokens are ignored (prompt no longer comes from argv)
  }
  return out;
}

// Resolve effective read-only state: explicit user flag wins over the default.
function resolveReadOnly(defaultReadOnly, writeOverride) {
  if (writeOverride === true) return false;  // --write
  if (writeOverride === false) return true;  // --read-only
  return defaultReadOnly;                     // subcommand default
}

// ---------- main ----------
const [, , sub, ...rest] = process.argv;
const cwd = process.cwd();
(async () => {
  let code = 0;
  const f = parseFlags(rest);
  const stdinText = ["ask", "task", "rescue", "research", "review", "adversarial-review"].includes(sub) ? readStdin() : "";

  // Per-command default read-only state; user --write / --read-only overrides it.
  // workdir is the write target: only granted when the run is write-capable.
  const run = async (kind, prompt, defaultReadOnly) => {
    const readOnly = resolveReadOnly(defaultReadOnly, f.writeOverride);
    const workdir = readOnly ? "" : cwd;
    return runJob(kind, prompt, { workdir, timeoutMs: f.timeoutMs, readOnly });
  };

  switch (sub) {
    case "ask":
      code = await run("ask", stdinText, /*defaultReadOnly*/ true);
      break;
    case "task":
    case "rescue":
      code = await run("task", `Do this task in the current project. You MAY edit files.\n\n${stdinText}`, /*defaultReadOnly*/ false);
      break;
    case "research":
      code = await run("research", `Research the following and give a synthesized, well-structured answer with concrete details:\n\n${stdinText}`, /*defaultReadOnly*/ true);
      break;
    case "review": {
      const { diff } = collectDiff();
      code = await run("review", reviewPrompt(stdinText, diff, false), /*defaultReadOnly*/ true);
      break;
    }
    case "adversarial-review": {
      const { diff } = collectDiff();
      code = await run("adversarial-review", reviewPrompt(stdinText, diff, true), /*defaultReadOnly*/ true);
      break;
    }
    case "setup": code = await cmdSetup(); break;
    case "status": code = cmdStatus(); break;
    case "result": code = cmdResult(rest[0]); break;
    case "cancel": code = cmdCancel(rest[0]); break;
    default:
      console.error(`Unknown subcommand: ${sub || "(none)"}\nValid: ask task research review adversarial-review setup status result cancel`);
      code = 2;
  }
  process.exitCode = code; // let stdout flush naturally instead of hard process.exit
})();
