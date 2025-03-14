import child_process from "node:child_process";
import fs from "node:fs";

const outputFile = "./tsc.local.txt";

const typesFolder = "@types";
const LAST_RUN_FILE = "config/last_run.local.json";

function getLastSavedCommit() {
  try {
    const data = fs.readFileSync(LAST_RUN_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return {commit: 0};
  }
}

function saveLastCommit(commit) {
  fs.writeFileSync(LAST_RUN_FILE, JSON.stringify({commit}));
}

function getLastCommitSha() {
  return child_process.execSync(`git log -1 --format=%H ${typesFolder}`).toString().trim();
}

function getModifiedFiles() {
  return child_process.execSync(`git status --porcelain ${typesFolder}`).toString().trim();
}

const colors = {};
const colorsCode = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

Object.keys(colorsCode).forEach(name => {
  const tagFunction = (strings, ...values) => {
    return `${colorsCode[name]}${strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '')}${colorsCode.reset}`;
  };
  colors[name] = tagFunction;
});

function createClickableErrorFile(output) {
  const cwd = process.cwd().replace(/\\/g, '/');
  const formattedLines = output.trim().replace(/(addon\/[^(]*\(\d*,\d*\):)/g, `${cwd}/$&`);
  fs.writeFileSync(outputFile, formattedLines);
  console.log(`Typecheck results with clickable links saved to ${outputFile}`);
}

function runTsc(build) {
  const command = build ? `tsc --build` : `tsc --build --incremental`;
  let output;
  try {
    output = child_process.execSync(command, {encoding: 'utf8'});
  } catch (error) {
    output = error.stdout;
  }
  if (output) {
    const errorCount = (output.match(/error TS\d+/g) || []).length;
    const errorsString = errorCount > 1 ? "errors" : "error";
    console.log(colors.red`Typecheck completed with ${errorCount} ${errorsString}.`);
    createClickableErrorFile(output);
  } else {
    fs.writeFileSync(outputFile, "No errors found!", "utf8");
    console.log(colors.green`Typecheck completed successfully. No errors found!`);
  }
}

function main() {
  const lastCommitSha = getLastCommitSha();
  const lastSavedSha = getLastSavedCommit().commit;
  const modifiedFiles = getModifiedFiles();

  if (lastCommitSha !== lastSavedSha || modifiedFiles) {
    saveLastCommit(lastCommitSha);
    runTsc(true);
  } else {
    runTsc(false);
  }
}

main();
