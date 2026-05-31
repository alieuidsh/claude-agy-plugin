#!/usr/bin/env node
// Unit tests for cleanOutput / extractAnswer — the v2 parser core (PTY output -> clean answer).
// Pure Node, no deps. Run: node tests/clean-output.test.mjs
import { cleanOutput, extractAnswer } from "../plugins/agy/scripts/agy-companion.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, d = "") => { if (cond) { pass++; console.log("  PASS  " + name); } else { fail++; console.log("  FAIL  " + name + (d ? " — " + d : "")); } };
const ESC = "\x1b";

console.log("agy v2 cleanOutput tests\n");

// 1. UTF-8 BOM stripped (the real agy short-answer case).
ok("strips UTF-8 BOM", cleanOutput("﻿2\r\n") === "2\n", JSON.stringify(cleanOutput("﻿2\r\n")));

// 2. CSI color codes stripped.
ok("strips CSI color", cleanOutput(`${ESC}[32mhello${ESC}[0m`) === "hello", JSON.stringify(cleanOutput(`${ESC}[32mhello${ESC}[0m`)));

// 3. OSC (title) sequence stripped.
ok("strips OSC title", cleanOutput(`${ESC}]0;title${"\x07"}answer`) === "answer", JSON.stringify(cleanOutput(`${ESC}]0;title\x07answer`)));

// 4. Lone CR (drip redraw) removed, real newline kept.
ok("removes lone CR keeps LF", cleanOutput("a\rb\nc") === "ab\nc", "got " + JSON.stringify(cleanOutput("a\rb\nc")));

// 5. extractAnswer trims and collapses blank lines.
ok("extractAnswer trims", extractAnswer("﻿\n\n  The answer is 42.  \n\n\n") === "The answer is 42.", JSON.stringify(extractAnswer("﻿\n\n  The answer is 42.  \n\n\n")));

// 6. Chinese answer survives cleaning.
ok("keeps CJK", cleanOutput("﻿玉山\r\n") === "玉山\n", JSON.stringify(cleanOutput("﻿玉山\r\n")));

// 7. Mixed ANSI + drip + BOM -> clean multi-line.
{
  const raw = `﻿${ESC}[?25l${ESC}[32mPart one.${ESC}[0m\r\nPart two.\r\n${ESC}[?25h`;
  ok("mixed noise cleaned", extractAnswer(raw) === "Part one.\nPart two.", JSON.stringify(extractAnswer(raw)));
}

// 8. Empty / whitespace -> empty (so caller treats as no-answer).
ok("blank -> empty", extractAnswer(`${ESC}[0m\r\n  \r\n`) === "", JSON.stringify(extractAnswer(`${ESC}[0m\r\n  \r\n`)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
