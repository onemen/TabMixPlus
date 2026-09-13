/*
 * Validate the decision records in docs/decisions/:
 *
 * - numbering: NNNN must be unique and zero-padded (duplicates fail; gaps warn)
 * - slug: NNNN-kebab-case-slug.md
 * - status: every record has a Status line; `superseded by NNNN` must link an existing record
 * - index: every record is listed in docs/decisions/index.md, and every ./NNNN link there
 *   resolves; cross-links between records must resolve too
 *
 * Usage: node config/check-decisions.mjs
 */

/* eslint-disable no-console -- standalone Node CLI script; stdout output is its interface */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "docs", "decisions");
const INDEX = path.join(DIR, "index.md");

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];
const fail = msg => errors.push(msg);
const warn = msg => warnings.push(msg);

/**
 * True when the slug part is kebab-case (lowercase words joined by single
 * hyphens).
 */
function isKebab(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// Collect records: NNNN-slug.md
const files = fs.readdirSync(DIR).filter(f => /^\d{4}-.+\.md$/.test(f));
/** @type {Map<string, {file: string; slug: string; status: string}>} */
const records = new Map();

for (const file of files) {
  const match = /^(?<num>\d{4})-(?<slug>.+)\.md$/.exec(file);
  if (!match?.groups) continue; // unreachable given the filter
  const {num, slug} = match.groups;

  if (!isKebab(slug)) {
    fail(`${file}: slug "${slug}" is not kebab-case (lowercase words, single hyphens)`);
  }

  const text = fs.readFileSync(path.join(DIR, file), "utf8");
  const statusLine = /^- \*\*Status:\*\* (.*)$/m.exec(text)?.[1] ?? "";
  if (!statusLine) {
    fail(`${file}: missing "**Status:**" line`);
  }

  if (records.has(num)) {
    fail(`${file}: duplicate record number ${num} (also ${records.get(num)?.file})`);
  }
  records.set(num, {file, slug, status: statusLine});
}

// Gaps in numbering (warning only — history may legitimately skip numbers)
const nums = [...records.keys()].map(Number).sort((a, b) => a - b);
for (let i = 1; i < nums.length; i++) {
  if (nums[i] !== nums[i - 1] + 1) {
    warn(
      `numbering gap: ${String(nums[i - 1]).padStart(4, "0")} -> ${String(nums[i]).padStart(4, "0")}`
    );
  }
}

// Superseded links must point at existing records
for (const rec of records.values()) {
  const sup = /superseded by \[?(\d{4})\]?/i.exec(rec.status);
  if (sup && !records.has(sup[1])) {
    fail(`${rec.file}: "superseded by ${sup[1]}" but ${sup[1]} does not exist`);
  }
}

// Index checks
if (!fs.existsSync(INDEX)) {
  fail("docs/decisions/index.md is missing");
} else {
  const indexText = fs.readFileSync(INDEX, "utf8");

  // Every record must be linked from the index (Historical counts; "none yet" does not)
  const indexHas = (num, slug) => indexText.includes(`./${num}-${slug}.md`);
  for (const [num, rec] of records) {
    if (!indexHas(num, rec.slug)) {
      fail(`index.md: record ${num}-${rec.slug}.md is not linked from the index`);
    }
  }

  // Every ./NNNN link in the index must resolve to a record
  for (const match of indexText.matchAll(/\]\(\.\/(\d{4})-([a-z0-9-]+)\.md\)/g)) {
    const [num, slug] = [match[1], match[2]];
    const rec = records.get(num);
    if (!rec) {
      fail(`index.md: link ./${num}-${slug}.md points at a missing record`);
    } else if (rec.slug !== slug) {
      fail(`index.md: link ./${num}-${slug}.md has a stale slug (record is ${num}-${rec.slug}.md)`);
    }
  }
}

// Cross-record links (e.g. "superseded by [0002](./0002-....md)") must resolve
for (const rec of records.values()) {
  const text = fs.readFileSync(path.join(DIR, rec.file), "utf8");
  for (const match of text.matchAll(/\]\(\.\/(\d{4})-[a-z0-9-]+\.md\)/g)) {
    if (!records.has(match[1])) {
      fail(`${rec.file}: link ./${match[1]}-....md points at a missing record`);
    }
  }
}

// Report
const pad = n => String(n).padStart(2, "0");
if (warnings.length) {
  for (const w of warnings) console.warn(`warning: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncheck-decisions: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(
  `check-decisions: ${pad(records.size)} records OK` +
    (warnings.length ? ` (${warnings.length} warning(s))` : "")
);
