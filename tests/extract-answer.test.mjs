#!/usr/bin/env node
// Unit tests for the agy transcript parser — the heart of this plugin.
// Pure Node, no deps. Run:  node tests/extract-answer.test.mjs
//
// Covers the cases that actually break in the wild: chunked long answers, multiple
// runs in one transcript (run-scoping), schema drift (renamed fields), missing
// nonce, malformed JSONL, chain-of-thought leakage, and the drift hand-off path.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractFromRows, heuristicAnswer } from "../plugins/agy/scripts/agy-companion.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");

let pass = 0, fail = 0;
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}
function parseJsonl(file) {
  const out = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed (intentional in a fixture) */ }
  }
  return out;
}
function rowsOf(fixture) { return parseJsonl(join(FIX, fixture)); }

console.log("agy parser tests\n");

// 1. Single-segment answer, normal format.
{
  const r = extractFromRows(rowsOf("single.jsonl"), "NONCE_SINGLE");
  ok("single-segment answer", r.matched && r.answer === "The capital of France is Paris." && !r.formatDrift, JSON.stringify(r));
}

// 2. Long answer chunked across multiple PLANNER_RESPONSE rows → joined in order.
{
  const r = extractFromRows(rowsOf("multi-segment.jsonl"), "NONCE_MULTI");
  ok("multi-segment joined in step order", r.matched && r.answer === "Part one.\n\nPart two.\n\nPart three.", JSON.stringify(r.answer));
}

// 3. Two runs in ONE transcript → only OUR run's answer, no bleed-in.
{
  const rows = rowsOf("two-runs.jsonl");
  const a = extractFromRows(rows, "NONCE_A");
  const b = extractFromRows(rows, "NONCE_B");
  ok("run-scoping: run A isolated", a.answer === "Answer for A.", JSON.stringify(a.answer));
  ok("run-scoping: run B isolated", b.answer === "Answer for B.", JSON.stringify(b.answer));
}

// 4. Schema drift (renamed type/field) → heuristic recovers, no formatDrift.
{
  const r = extractFromRows(rowsOf("drift-recoverable.jsonl"), "NONCE_DRIFT");
  ok("schema drift recovered by heuristic", r.matched && !r.formatDrift && r.answer === "Recovered from a renamed schema.", JSON.stringify(r));
}

// 5. Nonce not present anywhere → matched:false (don't return a stale answer).
{
  const r = extractFromRows(rowsOf("single.jsonl"), "NONCE_NOT_THERE");
  ok("missing nonce → not matched", r.matched === false && r.answer === null, JSON.stringify(r));
}

// 6. Malformed JSONL lines are skipped; the good answer still parses.
{
  const r = extractFromRows(rowsOf("malformed.jsonl"), "NONCE_MAL");
  ok("malformed lines skipped", r.matched && r.answer === "Survived the junk lines.", JSON.stringify(r));
}

// 7. Matched our run but nothing parseable → formatDrift:true (Claude layer-2 hand-off).
{
  const r = extractFromRows(rowsOf("drift-unrecoverable.jsonl"), "NONCE_HARD");
  ok("unrecoverable drift → formatDrift", r.matched && r.answer === null && r.formatDrift === true, JSON.stringify(r));
}

// 8. heuristicAnswer must NOT leak chain-of-thought (thinking/plan fields).
{
  const rows = [
    { type: "MODEL_TURN", source: "assistant", thinking: "secret chain of thought must never leak", content: "The visible answer." },
  ];
  const a = heuristicAnswer(rows, "X");
  ok("no chain-of-thought leak", a === "The visible answer.", JSON.stringify(a));
}

// 9. heuristicAnswer keeps short answers (no length gate) from a content key.
{
  const a = heuristicAnswer([{ type: "response", source: "model", text: "7" }], "X");
  ok("short answer kept", a === "7", JSON.stringify(a));
}

// 10. Pure planning/tool rows → null (so the caller falls through to layer-2).
{
  const a = heuristicAnswer([
    { type: "PLAN_STEP", source: "model", plan: "do x" },
    { type: "TOOL_CALL", source: "system", output: "ran a tool" },
  ], "X");
  ok("planning/tool noise → null", a === null, JSON.stringify(a));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
