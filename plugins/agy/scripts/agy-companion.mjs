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

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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
    candidates.push(join(la, "agy", "bin", "agy.exe"));     // older layout (this machine)
    candidates.push(join(la, "Antigravity", "agy.exe"));    // official installer layout
    candidates.push(join(la, "Antigravity", "bin", "agy.exe"));
  } else {
    candidates.push(join(HOME, ".local", "bin", "agy"));    // official installer layout
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
function runAgy(prompt, { workdir = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS, readOnly = false, nonce, onSpawn } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let promptFile = null; // set below if the prompt is too long for the command line
    const done = (v) => {
      if (settled) return;
      settled = true;
      if (promptFile) { try { unlinkSync(promptFile); } catch { /* best effort */ } }
      resolve(v);
    };

    const exe = findAgy();
    if (!exe) {
      done({ ok: false, error: "agy CLI not installed. Run /agy:install (installs it for you, asks first), or install manually: " + officialInstallCmd() });
      return;
    }
    const startedAt = Date.now();
    const taggedPrompt = nonce ? `[run:${nonce}]\n${prompt}` : prompt;

    // ENAMETOOLONG guard: agy takes the prompt as a command-line argument, and OS
    // command-line length is capped (~32 KB on Windows). A long prompt (e.g. a big
    // diff for review) overflows it and spawn throws ENAMETOOLONG. So when the
    // prompt is large, write it to a file and pass a SHORT instruction that tells
    // agy (an agent that can read files) to read it. The nonce stays in the short
    // command-line prompt, so transcript matching still works. Small prompts keep
    // the proven inline path unchanged.
    const PROMPT_INLINE_LIMIT = 8000; // chars; well under the OS arg-size ceiling
    let cmdPrompt = taggedPrompt;
    if (taggedPrompt.length > PROMPT_INLINE_LIMIT) {
      try {
        ensureJobs();
        promptFile = join(JOBS, `prompt_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}.txt`);
        writeFileSync(promptFile, taggedPrompt, "utf8");
        cmdPrompt = `${nonce ? `[run:${nonce}]\n` : ""}Your full instructions are in this UTF-8 text file: ${promptFile}\nRead that entire file and do exactly what it says. Treat its contents as the user's prompt.`;
      } catch {
        promptFile = null;
        cmdPrompt = taggedPrompt; // fall back to inline; may still ENAMETOOLONG, but best effort
      }
    }

    // CRITICAL ARG ORDER: boolean flags first; --print <prompt> LAST.
    const args = [];
    if (!readOnly) args.push("--dangerously-skip-permissions");
    if (workdir) args.push("--add-dir", workdir);
    args.push("--print", cmdPrompt);

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
        let res;
        try { res = extractAnswer(startedAt - 3000, nonce); } catch (e) {
          done({ ok: false, error: `failed to read agy transcript: ${e.message}` });
          return;
        }
        if (res.answer == null) {
          if (res.formatDrift && res.transcriptPath) {
            // Self-heal layer 2: hand the raw transcript path back so the caller can
            // have Claude extract the answer directly — no plugin update needed.
            done({ ok: false, formatDrift: true, transcriptPath: res.transcriptPath, error: "agy transcript format not recognized" });
          } else if (res.formatDrift) {
            done({ ok: false, error: "agy ran but its transcript format wasn't recognized — the agy CLI may have changed. Update this plugin: `claude plugin update agy` (then restart)." });
          } else {
            const hint = stderr.trim() ? ` agy stderr: ${stderr.trim().slice(0, 300)}` : "";
            done({ ok: false, error: `agy produced no matching response${exitInfo ? ` (${exitInfo})` : ""}.${hint}` });
          }
        } else {
          done({ ok: true, answer: res.answer });
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

    // Report the PID to the caller IMMEDIATELY on spawn (not after the run ends),
    // so a concurrent `cancel` can target this job's process tree while it runs.
    // (A shared static would be clobbered by parallel jobs — use the callback.)
    if (typeof onSpawn === "function" && child.pid) onSpawn(child.pid);
  });
}

function killTree(pid) {
  if (!pid) return;
  // Kill ONLY this PID's process tree. On Windows `taskkill /T` already kills the
  // whole descendant tree, so agy's helper (webm_encoder.exe) spawned by THIS agy
  // goes with it. We deliberately do NOT kill webm_encoder by image name, which
  // would also kill helpers of other concurrent jobs.
  try {
    if (IS_WIN) execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch { /* already gone */ }
}

// Format-agnostic fallback (SELF-HEAL layer 1): if agy renames its fields/types,
// the precise parser returns nothing. Recover the answer from model-ish rows using
// an ALLOWLIST of answer-bearing keys, taking the SINGLE best field PER ROW. This
// (a) never leaks chain-of-thought (thinking/reasoning/plan are not in the allowlist),
// (b) never concatenates arbitrary fields into a garbled blob, and (c) accepts short
// answers like "7". Reviewed 4th round by codex + agy (both flagged the prior denylist).
const CONTENT_KEYS = ["content", "text", "message", "answer", "response", "output_text", "output", "reply"];
function heuristicAnswer(runRows, nonce) {
  const looksModel = (o) => {
    if (!o || typeof o !== "object") return false; // tolerate bare null/number rows
    const t = (String(o.type || "") + " " + String(o.source || "") + " " + String(o.role || "")).toLowerCase();
    const modelish = /model|assistant|response|answer|reply|\bai\b|gemini|\bbot\b|message|\bmsg\b/.test(t);
    const otherish = /user|request|tool|system|plan|thought|think|reason|scratch/.test(t);
    return modelish && !otherish;
  };
  // Sort by step_index so multi-row recovery joins in chronological order, not
  // input order (callers may pass rows unsorted). (Reviewed: finding #7.)
  const ordered = runRows.filter((o) => o && typeof o === "object")
    .slice().sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0));
  const segs = [];
  for (const o of ordered) {
    if (!looksModel(o)) continue;
    // One field per row: first present allowlisted key with a non-empty string.
    for (const k of CONTENT_KEYS) {
      const v = o[k];
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!s || s.includes(nonce)) continue;
      segs.push(s);
      break;
    }
  }
  if (!segs.length) return null;
  const seen = new Set(); const uniq = [];
  for (const s of segs) if (!seen.has(s)) { seen.add(s); uniq.push(s); }
  return uniq.join("\n\n");
}

// ---------- read agy's answer from this run's transcript ----------
// Returns { answer, formatDrift, transcriptPath }:
//   answer        — the joined response text, or null if not found
//   formatDrift   — true when we found THIS run's transcript (our nonce is in it, so
//                   agy DID run our prompt) but neither the precise parser nor the
//                   heuristic could extract a response → agy's schema changed.
//   transcriptPath— path of our run's transcript, so the caller can hand it to
//                   Claude for self-healing extraction (layer 2) without an update.
function extractAnswer(sinceMs, nonce) {
  if (!existsSync(BRAIN)) return { answer: null, formatDrift: false, transcriptPath: null };
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
    for (const f of files) {
      let rows;
      try { rows = parseJsonl(f); } catch { continue; }
      const r = extractFromRows(rows, nonce);
      if (r.matched) return { answer: r.answer, formatDrift: r.formatDrift, transcriptPath: f };
    }
    // Nonce never found in any recent transcript → agy probably didn't run (timeout/auth).
    return { answer: null, formatDrift: false, transcriptPath: null };
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
  return { answer: best, formatDrift: false, transcriptPath: null };
}

// PURE, unit-testable core: given parsed transcript rows + our nonce, extract THIS
// run's answer. Returns { matched, answer, formatDrift }. Takes ONLY the rows from
// our matching USER_INPUT up to (not incl.) the next USER_INPUT, so multiple runs
// appended to one transcript file don't bleed together.
function extractFromRows(rows, nonce) {
  // Guard against non-object rows (a bare `null`/number/true line is valid JSONL
  // and would otherwise crash the sort/access below).
  const sorted = rows.filter((o) => o && typeof o === "object")
    .sort((a, b) => Number(a.step_index ?? 0) - Number(b.step_index ?? 0));
  const startIdx = sorted.findIndex(
    (o) => o.type === "USER_INPUT" && typeof o.content === "string" && o.content.includes(nonce),
  );
  if (startIdx === -1) return { matched: false, answer: null, formatDrift: false };
  let endIdx = sorted.length;
  for (let i = startIdx + 1; i < sorted.length; i++) {
    if (sorted[i].type === "USER_INPUT") { endIdx = i; break; }
  }
  const runRows = sorted.slice(startIdx + 1, endIdx); // exclude our prompt row
  // Precise parser (known format). agy emits its reasoning/plan as PLANNER_RESPONSE
  // rows too, interleaved with tool-call rows; the actual answer is the FINAL block
  // of such rows. So take only the LAST CONTIGUOUS GROUP of MODEL PLANNER_RESPONSE
  // rows (a non-MODEL-PLANNER_RESPONSE row — e.g. a tool call — breaks the group).
  // This drops planning chatter while still joining a long answer that agy chunked
  // across consecutive rows. (Reviewed: workflow finding #1 — chain-of-thought leak.)
  const isModelResp = (o) => o.type === "PLANNER_RESPONSE" && o.source === "MODEL" && o.content && String(o.content).trim();
  let lastGroup = [];
  let cur = [];
  for (const o of runRows) {
    if (isModelResp(o)) { cur.push(String(o.content).trim()); }
    else if (cur.length) { lastGroup = cur; cur = []; }
  }
  if (cur.length) lastGroup = cur;
  if (lastGroup.length) return { matched: true, answer: lastGroup.join("\n\n"), formatDrift: false };
  // Self-heal layer 1: heuristic (survives field/type renames).
  const heur = heuristicAnswer(runRows, nonce);
  if (heur) return { matched: true, answer: heur, formatDrift: false };
  // Matched our transcript but couldn't extract → real drift (Claude layer 2).
  return { matched: true, answer: null, formatDrift: true };
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
// argv-array form (spawnSync, shell:false) — no string interpolation, so a branch
// name / pathspec added later can never inject. Matches the spawn() style elsewhere.
function git(argv) {
  try {
    const r = spawnSync("git", argv, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, shell: false });
    return r.status === 0 && typeof r.stdout === "string" ? r.stdout : "";
  } catch { return ""; }
}
function collectDiff() {
  const status = git(["status", "--short", "--untracked-files=all"]);
  const staged = git(["diff", "--cached"]);
  const unstaged = git(["diff"]);
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

  // onSpawn persists the PID the moment agy launches, so `cancel` works mid-run.
  const r = await runAgy(prompt, {
    workdir, timeoutMs, readOnly, nonce,
    onSpawn: (pid) => {
      try {
        const mm = readMeta(id);
        mm.pid = pid;
        writeMeta(id, mm);
        // If a cancel arrived before the PID was recorded, honor it now.
        if (mm.cancelRequested) killTree(pid);
      } catch { /* meta race; non-fatal */ }
    },
  });

  let out, status, exitCode;
  if (r.ok) {
    out = r.answer; status = "done"; exitCode = 0;
  } else if (r.formatDrift && r.transcriptPath) {
    // Self-heal layer 2: emit a hand-off the calling assistant acts on. Status is the
    // HONEST "needs_extraction" (not "done") so /agy:status / callers don't misread
    // drift as success; exit stays 0 so the assistant still receives the handoff block.
    out = driftHandoffBlock(r.transcriptPath, nonce); status = "needs_extraction"; exitCode = 0;
  } else {
    out = `ERROR: ${r.error}`; status = "failed"; exitCode = 1;
  }
  writeFileSync(jobOutPath(id), out, "utf8");
  const m = readMeta(id);
  m.status = status;
  m.end = new Date().toISOString();
  writeMeta(id, m);

  // Print the answer to stdout (clean UTF-8). Use a callback to ensure the write
  // flushes before we exit (process.exit can truncate a pending pipe write).
  await new Promise((res) => process.stdout.write(out + "\n", () => res()));
  return exitCode;
}

// Self-heal layer 2: when the plugin can't parse agy's (changed) transcript, emit
// this block. The calling assistant (Claude) reads the raw transcript and extracts
// the answer itself — recovering on the spot, with NO plugin update required.
function driftHandoffBlock(transcriptPath, nonce) {
  // Strip control chars so a weird directory name can't corrupt the block layout.
  const safePath = String(transcriptPath).replace(/[\r\n\x00-\x1f]/g, "");
  return [
    "AGY_NEEDS_CLAUDE_EXTRACTION",
    "agy ran successfully, but this plugin could not parse its answer — agy's",
    "transcript format appears to have changed. Recover it yourself, no update needed:",
    `  1. Read this file: ${safePath}`,
    `  2. Find the entry whose text contains the marker: [run:${nonce}]`,
    "  3. After that entry (up to the next user-input entry), gather the model's",
    "     actual reply text — the substantive answer, not tool-call/planning chatter.",
    "  4. Present that text to the user as agy's answer.",
    "(Optional: mention `/plugin update agy` may restore the clean path — not required.)",
  ].join("\n");
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
    if (m.pid) {
      killTree(m.pid);            // targeted: only THIS job's process tree
    } else {
      // PID not recorded yet (job spawned but onSpawn hasn't fired). Leave a
      // cancel request; onSpawn checks this flag and kills itself immediately.
      m.cancelRequested = true;
      writeFileSync(join(JOBS, f), JSON.stringify(m, null, 2), "utf8");
    }
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
  if (!exe) { console.log(notInstalledHint()); return 1; }
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

// Official agy install command for the current OS (verified: antigravity.google/docs/cli-install).
function officialInstallCmd() {
  return IS_WIN
    ? `powershell -NoProfile -Command "irm https://antigravity.google/cli/install.ps1 | iex"`
    : `curl -fsSL https://antigravity.google/cli/install.sh | bash`;
}
function notInstalledHint() {
  return [
    "The agy (Google Antigravity) CLI is not installed.",
    "",
    "Install it with the official command for your OS:",
    `  ${officialInstallCmd()}`,
    "",
    "Or run `/agy:install` and I can install it for you (it asks first).",
    "After installing, run `agy` once interactively to sign in with your Google account.",
  ].join("\n");
}

// `check-install`: NEVER installs — only reports state + the official command.
// This is the safe default; the slash command runs this first.
function cmdCheckInstall() {
  const existing = findAgy();
  if (existing) { console.log(`INSTALLED: ${existing}`); return 0; }
  console.log("NOT_INSTALLED");
  console.log(notInstalledHint());
  return 0; // not an error — just a status report
}

// `install`: runs the official remote installer — but ONLY with explicit --yes.
// Without --yes it refuses and just prints what it would do. This guards against
// a mis-step ever turning a "check" into "download & execute a remote script".
async function cmdInstall(confirmed) {
  const existing = findAgy();
  if (existing) { console.log(`agy is already installed at: ${existing}`); return 0; }
  const cmd = officialInstallCmd();
  if (!confirmed) {
    console.log("Refusing to install without confirmation.");
    console.log("This would download and execute the official installer:");
    console.log(`  ${cmd}`);
    console.log("Re-run with --yes to proceed:  /agy:install (it will ask first), or `... install --yes`.");
    return 2;
  }
  console.log(`Installing the agy CLI via the official installer:\n  ${cmd}\n`);
  try {
    // Inherit stdio so the user can see the installer's progress/prompts.
    if (IS_WIN) {
      execSync(`powershell -NoProfile -Command "irm https://antigravity.google/cli/install.ps1 | iex"`, { stdio: "inherit" });
    } else {
      execSync(`curl -fsSL https://antigravity.google/cli/install.sh | bash`, { stdio: "inherit", shell: "/bin/bash" });
    }
  } catch (e) {
    console.log(`\n❌ Installer failed: ${e.message}`);
    console.log("You can install manually with the command above, then re-run /agy:setup.");
    return 1;
  }
  const nowInstalled = findAgy();
  if (nowInstalled) {
    console.log(`\n✅ agy installed at: ${nowInstalled}`);
    console.log("Next: run `agy` once interactively to sign in with your Google account, then /agy:setup to verify.");
    return 0;
  }
  console.log("\n⚠️ Installer finished but agy was not found on PATH/known locations.");
  console.log("You may need to restart your terminal, or set AGY_BIN to the agy executable path.");
  return 1;
}

// ---------- arg parsing (flags only; prompt comes from stdin) ----------
// `writeOverride`: null = use the subcommand's safe default; true = --write forces
// write-capable; false = --read-only forces read-only. Mirrors codex's model of a
// (parseFlags also recognizes --yes for the install subcommand.)
// safe default that the user can explicitly override.
function parseFlags(rest) {
  const out = { background: false, wait: false, timeoutMs: DEFAULT_TIMEOUT_MS, writeOverride: null, yes: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--background") out.background = true;
    else if (a === "--wait") out.wait = true;
    else if (a === "--write") out.writeOverride = true;
    else if (a === "--read-only" || a === "--readonly") out.writeOverride = false;
    else if (a === "--yes" || a === "-y") out.yes = true;
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

// Exported for unit tests (fixtures). Importing this module does NOT run main()
// thanks to the isMain guard below, so tests can call these pure functions safely.
export { extractAnswer, extractFromRows, heuristicAnswer, parseFlags, resolveReadOnly };

// ---------- main ----------
// Only run the CLI when executed directly (node agy-companion.mjs ...), not when
// imported by a test. Use pathToFileURL so paths with #, %, spaces, etc. are
// percent-encoded the same way import.meta.url is (manual string building wasn't).
const isMain = (() => {
  try { return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href; }
  catch { return false; }
})();

const [, , sub, ...rest] = process.argv;
const cwd = process.cwd();
async function main() {
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
      // Review is ALWAYS read-only — agy never edits during a review, even if the
      // user passes --write. Use /agy:rescue to act on review findings.
      const { diff } = collectDiff();
      code = await runJob("review", reviewPrompt(stdinText, diff, false), { workdir: "", timeoutMs: f.timeoutMs, readOnly: true });
      break;
    }
    case "adversarial-review": {
      const { diff } = collectDiff();
      code = await runJob("adversarial-review", reviewPrompt(stdinText, diff, true), { workdir: "", timeoutMs: f.timeoutMs, readOnly: true });
      break;
    }
    case "setup": code = await cmdSetup(); break;
    case "check-install": code = cmdCheckInstall(); break;
    case "install": code = await cmdInstall(f.yes); break;
    case "status": code = cmdStatus(); break;
    case "result": code = cmdResult(rest[0]); break;
    case "cancel": code = cmdCancel(rest[0]); break;
    default:
      console.error(`Unknown subcommand: ${sub || "(none)"}\nValid: ask task research review adversarial-review setup check-install install status result cancel`);
      code = 2;
  }
  process.exitCode = code; // let stdout flush naturally instead of hard process.exit
}
if (isMain) main();
