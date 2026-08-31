import child_process from "node:child_process";
import fs from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const outputFile = "./tsc.local.txt";

const typesFolder = "@types";
const LAST_RUN_FILE = "config/last_run.local.json";

// ---------------------------------------------------------------------------
// Tool selection: "tsc" vs "tsc7"
//
// The project compiles with TypeScript 7 (the native Go port), but
// typescript-eslint 8.x still requires the TypeScript 6 JS API and hard-fails
// on TS >= 7.0 (typescript-eslint/typescript-eslint#10940). So we run two
// packages side by side:
//
//   typescript   -> TS 6.x  (used by eslint / typescript-eslint)
//   typescript7  -> TS 7.x  (aliased "npm:typescript@^7.0.2", used for builds)
//
// "tsc7" resolves the typescript7 package; "tsc" resolves typescript.
// The "tsc:clean" script passes "tsc7"; the "typecheck" script calls
// node_modules/typescript7/bin/tsc directly (no runner, plain --build).
//
// WHEN TYPESCRIPT-ESLINT SUPPORTS TS 7 (tracked in #10940):
//   1. In package.json: drop the "typescript7" devDependency, bump
//      "typescript" to ^7, and update the "typecheck" script path
//      node_modules/typescript7/bin/tsc -> node_modules/typescript/bin/tsc.
//   2. Here: change TSC7_PACKAGE to null — "tsc7" then aliases the (now TS 7)
//      typescript package, so "tsc:clean" keeps working unchanged.
// Nothing else in this file needs to change.
// ---------------------------------------------------------------------------
const TSC_PACKAGE = "typescript";
const TSC7_PACKAGE = "typescript7"; // set to null when tseslint supports TS 7

const tool = process.argv[2] === "tsc7" ? "tsc7" : "tsc";

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

/**
 * Resolve a tool's real entry point from the project-local node_modules and run
 * it with `node <entry>` instead of a PATH shim. This avoids the Windows
 * execFile EINVAL on .cmd shims (CVE-2024-27980 mitigation) and pins the
 * project's own tool versions instead of whatever PATH resolves.
 */
function resolveToolCommand(toolName) {
  const packages = {
    tsc: {pkg: TSC_PACKAGE, binKey: "tsc"},
    // Once TSC7_PACKAGE is nulled (typescript-eslint supports TS 7 and the
    // typescript7 alias is dropped), "tsc7" falls back to the main typescript
    // package — no other change needed here or in the npm scripts.
    tsc7: {pkg: TSC7_PACKAGE ?? TSC_PACKAGE, binKey: "tsc"},
    eslint: {pkg: "eslint", binKey: "eslint"},
  };
  const spec = packages[toolName];
  if (!spec) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve(`${spec.pkg}/package.json`);
  } catch {
    console.error(colors.red`\n${spec.pkg} not found in this project — run "pnpm install" first.`);
    console.error(`(config/typecheck.js uses the project-local toolchain, not a global install.)`);
    process.exit(1);
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const binRel = pkgJson.bin?.[spec.binKey];
  if (!binRel) {
    console.error(
      colors.red`\n${spec.pkg} does not declare a "${spec.binKey}" bin entry — cannot run ${toolName}.`
    );
    process.exit(1);
  }
  const binPath = path.join(path.dirname(pkgJsonPath), binRel);

  // Node-script detection: shebang sniff (bin/tsc, bin/tsgo are extensionless
  // "#!/usr/bin/env node" launchers); anything else (e.g. a native .exe) runs
  // directly via execFile.
  const head = fs.readFileSync(binPath).subarray(0, 2).toString("utf8");
  if (head === "#!") {
    return [process.execPath, binPath];
  }
  return [binPath];
}

function execFileAsync(argv) {
  return new Promise((resolve, reject) => {
    child_process.execFile(argv[0], argv.slice(1), {encoding: "utf8"}, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout ?? "";
        error.stderr = stderr ?? "";
        reject(error);
      } else {
        resolve(stdout ?? "");
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
  return child_process
    .execFileSync("git", ["log", "-1", "--format=%H", typesFolder], {
      encoding: "utf8",
    })
    .trim();
}

function getModifiedFiles() {
  return child_process
    .execFileSync("git", ["status", "--porcelain", typesFolder], {
      encoding: "utf8",
    })
    .trim();
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

  const tscArgv = [...resolveToolCommand(tool), "--build"];

  if (lastCommitSha !== lastSavedSha || modifiedFiles) {
    saveLastCommit(lastCommitSha);

    const needLint =
      lastCommitSha !== lastSavedSha ||
      !!modifiedFiles.split("\n").filter(line => !line.includes("@types/gecko")).length;

    let lintPromise = Promise.resolve();
    if (needLint) {
      console.log(
        "Changes detected in @types folder. Running full typecheck and lint in parallel..."
      );
      lintPromise = execFileAsync([
        ...resolveToolCommand("eslint"),
        "--config",
        "config/eslint.dts.config.js",
        "--format",
        "stylish",
        "@types",
      ]);
    } else {
      console.log("Changes detected in @types folder. Running full typecheck...");
    }

    const tscPromise = execFileAsync(tscArgv);

    const results = await Promise.allSettled([lintPromise, tscPromise]);
    const [lintResult, tscResult] = results;

    if (needLint) {
      console.log("--- ESLint for .d.ts files ---");
      if (lintResult.status === "rejected") {
        console.log(colors.red`Failed.`);
        if (lintResult.reason.stdout) console.log(lintResult.reason.stdout); // ESLint errors are in stdout
        if (lintResult.reason.stderr) console.error(lintResult.reason.stderr);
      } else {
        console.log(colors.green`Completed successfully.`);
        if (lintResult.value) {
          console.log(lintResult.value);
        }
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
      await execFileAsync([...tscArgv, "--incremental"]);
      fs.writeFileSync(outputFile, "No errors found!", "utf8");
      console.log(colors.green`Typecheck completed successfully. No errors found!`);
    } catch (error) {
      const errorStdout = error && typeof error.stdout === "string" ? error.stdout : "";
      const errorCount = (errorStdout.match(/error TS\d+/g) || []).length;
      const errorsString = errorCount > 1 ? "errors" : "error";
      console.log(colors.red`Typecheck completed with ${errorCount} ${errorsString}.`);
      createClickableErrorFile(errorStdout);
    }
  }
}

main().catch(err => {
  console.error("An unexpected error occurred:", err);
  process.exit(1);
});
