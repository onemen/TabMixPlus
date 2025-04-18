#!/usr/bin/env node

import fs from "node:fs";

console.log("Starting changelog processing...");

// Constants
const REPO_URL = "https://github.com/onemen/TabMixPlus";
const COMMIT_URL = `${REPO_URL}/commit/`;
console.log(`Using repository URL: ${REPO_URL}`);

// Read the changelog file
console.log("Reading CHANGELOG.md file...");
const content = fs.readFileSync("CHANGELOG.md", "utf8");
console.log(`Read ${content.length} characters from CHANGELOG.md`);

console.log("Preprocessing content...");
const contentLines = content
  .replace(/dev-Build/g, "dev-build")
  .replace("### :wrench: Chores", "### :wrench: Maintenance")
  .split("\n")
  .slice(5);
console.log(`Processing ${contentLines.length} lines after preprocessing`);

const footerLines = [];
let processingFooter = false;
let mainContentLines = [];

// Separate content into main content and footer
console.log("Separating content into main content and footer...");
for (const line of contentLines) {
  if (line.match(/^\[.*\]:/)) {
    processingFooter = true;
  }

  if (processingFooter) {
    footerLines.push(line);
  } else {
    mainContentLines.push(line);
  }
}
console.log(
  `Split content into ${mainContentLines.length} main lines and ${footerLines.length} footer lines`
);

// Process main content lines
console.log("Processing main content lines...");
mainContentLines = mainContentLines.map(line => {
  if (line.startsWith("- ")) {
    return line
      .replace(/ \*\(commit by \[@[\w-]+\]\(https:\/\/github\.com\/[\w-]+\)\)\*/g, "")
      .replace(/PR (\[#\d+\].*)?\s?by \[@onemen\].*?\)/g, "$1")
      .replace(/-\s*(\[.{9}\][^)]*\))\s-\s(.*)/g, "- $2 ($1)")
      .replace(/__/g, "\\_\\_")
      .replace(/followup/gi, "follow up")
      .replace(/^(-\s*)(\w)/g, (_, p1, p2) => p1 + p2.toUpperCase())
      .replace(/(Bug|bug)\s(\d{5,7})/g, "[$&](https://bugzilla.mozilla.org/show_bug.cgi?id=$2)");
  }
  return line;
});
console.log("Main content lines processed");

// Group entries with the same title
console.log("Grouping entries with the same title...");
const titleMap = new Map();
const processedLines = [];

const COMMIT_URL_ESC = COMMIT_URL.replace(/[./]/g, "\\$&");
const HASH_STR = "([\\w\\d]+)";
const REG_EXP_STR = `\\(\\[\`${HASH_STR}\`\\]\\(${COMMIT_URL_ESC}${HASH_STR}\\)\\)`;
const REGEXP = new RegExp(REG_EXP_STR);

const getTitle = line => {
  const titleMatch =
    line.startsWith("- ") && line.includes(COMMIT_URL) ?
      line.match(/- (.+?)\s\(\[`[\w\d]+`\]/)
    : null;
  return titleMatch ? titleMatch[1] : null;
};

for (const line of mainContentLines) {
  const title = getTitle(line);
  if (title && titleMap.has(title)) {
    const commitMatch = line.match(REGEXP);
    if (commitMatch) {
      const shortHash = commitMatch[1];
      const fullHash = commitMatch[2];

      const existingLine = titleMap.get(title);
      const existingLineIndex = processedLines.indexOf(existingLine);

      const linkStr = `[\`${shortHash}\`](${COMMIT_URL}${fullHash})`;

      let updatedLine;
      if (existingLine.endsWith(")")) {
        updatedLine = existingLine.replace(/\)$/, `, ${linkStr})`);
      } else {
        updatedLine = `${existingLine} (${linkStr})`;
      }

      processedLines[existingLineIndex] = updatedLine;
      titleMap.set(title, updatedLine);
      continue;
    }
  } else {
    titleMap.set(title, line);
  }

  processedLines.push(line);
}
console.log(`Processed ${processedLines.length} lines after grouping`);

// Write the processed content back to CHANGELOG.md
console.log("Writing processed content back to CHANGELOG.md...");
const newContent = [...processedLines, ...footerLines];
const notes = process.env.NOTES;
console.log(
  `Adding notes from environment: ${notes ? notes.substring(0, 50) + "..." : "undefined"}`
);
newContent.unshift(notes);
fs.writeFileSync("CHANGELOG.md", newContent.join("\n"));
console.log("CHANGELOG.md updated successfully");
