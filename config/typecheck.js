import child_process from "node:child_process";
import fs from "node:fs";

const outputFile = "./tsc.local.txt";

const typesFolder = "@types";
const LAST_RUN_FILE = "config/last_run.local.json";

const colors = {};
const colorsCode = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

Object.keys(colorsCode).forEach(name => {
  const tagFunction = (strings, ...values) => {
    return `${colorsCode[name]}${strings.reduce((acc, str, i) => acc + str + (values[i] || ""), "")}${colorsCode.reset}`;
  };
  colors[name] = tagFunction;
});

function execAsync(command) {
  return new Promise((resolve, reject) => {
    child_process.exec(command, {encoding: "utf8"}, (error, stdout, stderr) => {
      if (error) {
        // Attach stdout/stderr to the error object for logging
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

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

function createClickableErrorFile(output) {
  const cwd = process.cwd().replace(/\\/g, "/");
  const formattedLines = output.trim().replace(/(addon\/[^(]*\(\d*,\d*\):)/g, `${cwd}/$&`);
  fs.writeFileSync(outputFile, formattedLines);
  console.log(`Typecheck results with clickable links saved to ${outputFile}`);
}

async function main() {
  const lastCommitSha = getLastCommitSha();
  const lastSavedSha = getLastSavedCommit().commit;
  const modifiedFiles = getModifiedFiles();

  if (lastCommitSha !== lastSavedSha || modifiedFiles) {
    console.log(
      "Changes detected in @types folder. Running full typecheck and lint in parallel..."
    );
    saveLastCommit(lastCommitSha);

    const lintCommand = "eslint --config config/eslint.dts.config.js --format stylish @types";
    const tscCommand = "tsc --build";

    const lintPromise = execAsync(lintCommand);
    const tscPromise = execAsync(tscCommand);

    const results = await Promise.allSettled([lintPromise, tscPromise]);
    const [lintResult, tscResult] = results;

    console.log("--- ESLint for .d.ts files ---");
    if (lintResult.status === "rejected") {
      console.log(colors.red`Failed.`);
      console.log(lintResult.reason.stdout); // ESLint errors are in stdout
    } else {
      console.log(colors.green`Completed successfully.`);
      if (lintResult.value) {
        console.log(lintResult.value);
      }
    }

    console.log("\n--- TypeScript Build ---");
    if (tscResult.status === "rejected") {
      const error = tscResult.reason;
      const errorCount = (error.stdout.match(/error TS\d+/g) || []).length;
      const errorsString = errorCount > 1 ? "errors" : "error";
      console.log(colors.red`Completed with ${errorCount} ${errorsString}.`);
      createClickableErrorFile(error.stdout);
    } else {
      fs.writeFileSync(outputFile, "No errors found!", "utf8");
      console.log(colors.green`Completed successfully. No errors found!`);
    }
  } else {
    console.log("No changes in @types folder. Running incremental typecheck.");
    try {
      await execAsync("tsc --build --incremental");
      fs.writeFileSync(outputFile, "No errors found!", "utf8");
      console.log(colors.green`Typecheck completed successfully. No errors found!`);
    } catch (error) {
      const errorCount = (error.stdout.match(/error TS\d+/g) || []).length;
      const errorsString = errorCount > 1 ? "errors" : "error";
      console.log(colors.red`Typecheck completed with ${errorCount} ${errorsString}.`);
      createClickableErrorFile(error.stdout);
    }
  }
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
