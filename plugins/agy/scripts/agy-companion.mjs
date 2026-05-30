#!/usr/bin/env node
// agy-companion.mjs — cross-platform runtime for the agy (Google Antigravity /
// Gemini) Claude Code plugin. The agy analogue of codex-companion.mjs.
//
// Works on Windows + Linux + macOS. Subcommands:
//   ask "<prompt>"                  one-shot question, prints answer
//   task "<prompt>"                 delegate work (agy may write files)
//   research "<prompt>"             research-framed question
//   review "[args]"                 review the local git diff (read-only)
//   adversarial-review "[args]"     adversarial review of the local git diff
//   setup                           health-check: is agy installed + authed?
//   status                          list recent jobs
//   result [id]                     print a job's stored answer
//   cancel [id]                     kill running agy + mark job cancelled
//
// Every run records job metadata under ~/.agy-jobs so status/result/cancel work
// even across separate Claude background tasks.
//
// KEY agy QUIRKS handled here:
//  1. `agy --print` writes its answer to the TTY, not stdout — we read it back
//     from the transcript agy persists under ~/.gemini/antigravity-cli/brain.
//  2. `--print` is a value flag (alias of --prompt): it consumes the NEXT arg as
//     the prompt. So boolean flags go FIRST and `--print <prompt>` goes LAST.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const HOME = homedir();
const IS_WIN = platform() === "win32";
const BRAIN = join(HOME, ".gemini", "antigravity-cli", "brain");
const JOBS = join(HOME, ".agy-jobs");
const DEFAULT_TIMEOUT_MS = 300_000;

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
  // Fall back to PATH lookup.
  try {
    const cmd = IS_WIN ? "where agy" : "command -v agy";
    const found = execSync(cmd, { encoding: "utf8" }).split(/\r?\n/)[0].trim();
    if (found && existsSync(found)) return found;
  } catch { /* not on PATH */ }
  return null;
}

// ---------- run agy headless, return the model's answer ----------
function runAgy(prompt, { workdir = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const exe = findAgy();
    if (!exe) {
      resolve({ ok: false, error: "agy binary not found. Set AGY_BIN or install Antigravity CLI.", answer: "" });
      return;
    }
    const startedAt = Date.now();
    // CRITICAL ARG ORDER: boolean flags first; --print <prompt> LAST.
    const args = ["--dangerously-skip-permissions"];
    if (workdir) args.push("--add-dir", workdir);
    args.push("--print", prompt);

    const child = spawn(exe, args, {
      stdio: ["ignore", "ignore", "ignore"], // answer comes from transcript, not stdout
      windowsHide: true,
      detached: !IS_WIN,
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, timeoutMs);

    child.on("exit", () => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ ok: false, error: `agy timed out after ${Math.round(timeoutMs / 1000)}s. Run \`agy\` once interactively to re-auth if this persists.`, answer: "" });
        return;
      }
      // Give agy a beat to flush the transcript, then extract the answer.
      setTimeout(() => {
        const answer = extractAnswer(startedAt - 3000);
        if (answer == null) resolve({ ok: false, error: "agy produced no MODEL response (auth issue or empty plan).", answer: "" });
        else resolve({ ok: true, answer });
      }, 1200);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `failed to spawn agy: ${e.message}`, answer: "" });
    });
  });
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (IS_WIN) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch { /* already gone */ }
  // agy spawns a helper that can linger.
  try {
    if (IS_WIN) execSync(`taskkill /F /IM webm_encoder.exe /T`, { stdio: "ignore" });
  } catch { /* none */ }
}

// ---------- read agy's answer from the newest transcript ----------
function extractAnswer(sinceMs) {
  if (!existsSync(BRAIN)) return null;
  let best = null, bestTs = "";
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
      let text;
      try { text = readFileSync(full, "utf8"); } catch { continue; }
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.type === "PLANNER_RESPONSE" && o.source === "MODEL" && o.content) {
          const ts = String(o.created_at || "");
          if (ts >= bestTs) { best = o.content; bestTs = ts; }
        }
      }
    }
  }
  return best;
}

// ---------- job metadata ----------
function ensureJobs() { try { mkdirSync(JOBS, { recursive: true }); } catch {} }
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

// ---------- run + record a job ----------
async function runJob(kind, prompt, { workdir, timeoutMs } = {}) {
  ensureJobs();
  const id = newJobId();
  const promptPreview = prompt.replace(/\s+/g, " ").slice(0, 200);
  writeMeta(id, { id, kind, status: "running", prompt: promptPreview, start: new Date().toISOString(), end: null });
  process.stderr.write(`[agy] job ${id} (${kind}) started\n`);
  const r = await runAgy(prompt, { workdir, timeoutMs });
  const out = r.ok ? r.answer : `ERROR: ${r.error}`;
  writeFileSync(jobOutPath(id), out, "utf8");
  const m = readMeta(id);
  m.status = r.ok ? "done" : "failed";
  m.end = new Date().toISOString();
  writeMeta(id, m);
  // Print the answer to stdout (clean UTF-8) — this is what Claude relays.
  process.stdout.write(out + "\n");
  return r.ok ? 0 : 1;
}

// ---------- subcommand: status / result / cancel ----------
function cmdStatus() {
  ensureJobs();
  const metas = readdirSync(JOBS).filter((f) => f.endsWith(".meta.json"))
    .map((f) => ({ f, t: statSync(join(JOBS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t).slice(0, 15);
  if (!metas.length) { console.log("(no agy jobs yet)"); return 0; }
  console.log("JOB ID                 KIND        STATUS     PROMPT");
  for (const { f } of metas) {
    const m = JSON.parse(readFileSync(join(JOBS, f), "utf8"));
    const p = (m.prompt || "").slice(0, 46);
    console.log(`${m.id.padEnd(22)} ${(m.kind || "").padEnd(11)} ${(m.status || "").padEnd(10)} ${p}`);
  }
  return 0;
}
function cmdResult(id) {
  ensureJobs();
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
function cmdCancel(id) {
  ensureJobs();
  killTree(null);
  try { if (IS_WIN) execSync("taskkill /F /IM agy.exe /T", { stdio: "ignore" }); else execSync("pkill -f agy", { stdio: "ignore" }); } catch {}
  let n = 0;
  for (const f of readdirSync(JOBS).filter((x) => x.endsWith(".meta.json"))) {
    const m = JSON.parse(readFileSync(join(JOBS, f), "utf8"));
    if ((!id || m.id === id) && m.status === "running") { m.status = "cancelled"; m.end = new Date().toISOString(); writeFileSync(join(JOBS, f), JSON.stringify(m, null, 2), "utf8"); n++; }
  }
  console.log(`Cancelled running agy processes; marked ${n} job(s) cancelled.`);
  return 0;
}
async function cmdSetup() {
  const exe = findAgy();
  console.log(`agy binary: ${exe || "NOT FOUND"}`);
  if (!exe) { console.log("Install Antigravity CLI, or set AGY_BIN to the agy executable path."); return 1; }
  console.log(`brain dir : ${existsSync(BRAIN) ? BRAIN : "(missing — agy never run?)"}`);
  console.log("Probing agy (auth + answer capture)…");
  const r = await runAgy("Reply with exactly this token: AGY_READY", { workdir: "", timeoutMs: 120_000 });
  if (r.ok && r.answer.includes("AGY_READY")) { console.log("RESULT: ✅ agy is ready."); return 0; }
  if (r.ok) { console.log(`RESULT: ⚠️ agy answered but unexpected: ${r.answer.slice(0, 120)}`); return 0; }
  console.log(`RESULT: ❌ ${r.error}`);
  console.log("If this is an auth error, run `agy` once interactively to sign in.");
  return 1;
}

// ---------- arg parsing ----------
function parseFlags(rest) {
  const out = { background: false, wait: false, timeoutMs: DEFAULT_TIMEOUT_MS, text: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--background") out.background = true;
    else if (a === "--wait") out.wait = true;
    else if (a === "--read-only") out.readOnly = true;
    else if (a === "--timeout" && rest[i + 1]) { out.timeoutMs = parseInt(rest[++i], 10) * 1000; }
    else out.text.push(a);
  }
  out.joined = out.text.join(" ").trim();
  return out;
}

// ---------- main ----------
const [, , sub, ...rest] = process.argv;
const cwd = process.cwd();
(async () => {
  let code = 0;
  switch (sub) {
    case "ask": { const f = parseFlags(rest); code = await runJob("ask", f.joined, { workdir: "", timeoutMs: f.timeoutMs }); break; }
    case "task":
    case "rescue": { const f = parseFlags(rest); code = await runJob("task", `Do this task in the current project. You MAY edit files.\n\n${f.joined}`, { workdir: cwd, timeoutMs: f.timeoutMs }); break; }
    case "research": { const f = parseFlags(rest); code = await runJob("research", `Research the following and give a synthesized, well-structured answer with concrete details:\n\n${f.joined}`, { workdir: "", timeoutMs: f.timeoutMs }); break; }
    case "review": { const f = parseFlags(rest); const { diff } = collectDiff(); code = await runJob("review", reviewPrompt(f.joined, diff, false), { workdir: cwd, timeoutMs: f.timeoutMs }); break; }
    case "adversarial-review": { const f = parseFlags(rest); const { diff } = collectDiff(); code = await runJob("adversarial-review", reviewPrompt(f.joined, diff, true), { workdir: cwd, timeoutMs: f.timeoutMs }); break; }
    case "setup": code = await cmdSetup(); break;
    case "status": code = cmdStatus(); break;
    case "result": code = cmdResult(rest[0]); break;
    case "cancel": code = cmdCancel(rest[0]); break;
    default:
      console.error(`Unknown subcommand: ${sub || "(none)"}\nValid: ask task research review adversarial-review setup status result cancel`);
      code = 2;
  }
  process.exit(code);
})();
