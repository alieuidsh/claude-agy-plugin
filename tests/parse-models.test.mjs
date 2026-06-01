#!/usr/bin/env node
// Unit tests for parseModelMenu — the /model menu scraper parser. Locks the 3-way-review
// #6 fix (single-space status-bar bleed must NOT drop a valid model). Pure, no deps.
import { __parseModelMenu as parse } from "../plugins/agy/scripts/agy-companion.mjs";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log("  PASS  " + name); }
  else { fail++; console.log("  FAIL  " + name + "\n        got  " + g + "\n        want " + w); }
};

console.log("parseModelMenu tests\n");

// 1. Clean menu — the real 8-model lineup.
eq("clean 8-model menu", parse([
  "  Gemini 3.5 Flash (Medium)",
  "> Gemini 3.5 Flash (High)      (current)",
  "  Gemini 3.5 Flash (Low)",
  "  Gemini 3.1 Pro (Low)",
  "  Gemini 3.1 Pro (High)",
  "  Claude Sonnet 4.6 (Thinking)",
  "  Claude Opus 4.6 (Thinking)",
  "  GPT-OSS 120B (Medium)",
].join("\n")), [
  "Gemini 3.5 Flash (Medium)", "Gemini 3.5 Flash (High)", "Gemini 3.5 Flash (Low)",
  "Gemini 3.1 Pro (Low)", "Gemini 3.1 Pro (High)", "Claude Sonnet 4.6 (Thinking)",
  "Claude Opus 4.6 (Thinking)", "GPT-OSS 120B (Medium)",
]);

// 2. #6 regression: single-space status-bar bleed must still extract the label.
eq("single-space status bleed", parse("Gemini 3.5 Pro (High) [Running] ? for shortcuts"),
  ["Gemini 3.5 Pro (High)"]);

// 3. "(current)" marker stripped, not kept as part of the label.
eq("strips (current)", parse("> Gemini 3.1 Pro (High) (current)"), ["Gemini 3.1 Pro (High)"]);

// 4. Cursor / bullet prefixes ignored.
eq("ignores prefixes", parse("•  Claude Opus 4.6 (Thinking)"), ["Claude Opus 4.6 (Thinking)"]);

// 5. Dedupe (the live buffer often repeats the current line in the status bar).
eq("dedupes", parse("Gemini 3.5 Flash (High)\nGemini 3.5 Flash (High)"), ["Gemini 3.5 Flash (High)"]);

// 6. Non-model lines dropped.
eq("drops non-model lines", parse("Switch Model\n↑/↓ Navigate\n  GPT-OSS 120B (Medium)\nesc to cancel"),
  ["GPT-OSS 120B (Medium)"]);

// 7. Lazy match stops at the FIRST tier paren, so trailing garbage after a valid label
//    is dropped (the label itself is short and valid) — this is the desired behavior.
eq("lazy stops at first tier", parse("Gemini 3.5 Flash (High)" + "x".repeat(60) + " (Low)"),
  ["Gemini 3.5 Flash (High)"]);

// 8. A genuinely over-long label (no early tier paren) IS rejected by the <60 guard.
eq("rejects truly long label", parse("Gemini " + "Ultra ".repeat(15) + "(High)"), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
