import {execFile} from "node:child_process";
import {join} from "node:path";
import {promisify} from "node:util";
import {rm} from "node:fs/promises";

const execFileAsync = promisify(execFile);

const env = {...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : "0"};

async function runCmd(cmd, innerPath, args) {
  const fullPath = join(process.cwd(), "node_modules", cmd, innerPath);
  try {
    console.time(cmd);
    const {stdout, stderr} = await execFileAsync("node", [fullPath, ...args], {
      env,
      windowsHide: true,
    });
    console.timeEnd(cmd);
    return {cmd, success: true, stdout, stderr};
  } catch (error) {
    return {
      cmd,
      success: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      code: error.code || 1,
      error,
    };
  }
}

// Get staged files
async function getStagedFiles() {
  const {stdout} = await execFileAsync("git", [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACM",
  ]);
  return stdout
    .split("\n")
    .map(f => f.trim())
    .filter(f => !f.startsWith("@types/gecko/"));
}

/**
 * Groups staged files by linter type.
 *
 * @param {string[]} files - List of staged file paths.
 * @returns {{
 *   eslintFiles: string[];
 *   prettierFiles: string[];
 *   stylelintFiles: string[];
 * }}
 */
function groupFiles(files) {
  const eslintFiles = [];
  const prettierFiles = [];
  const stylelintFiles = [];
  const eslintPattern = /\.(jsx?|tsx?|mjs|cjs|html?|xhtml)$/i;
  const prettierPattern = /\.(jsx?|tsx?|mjs|cjs|json|html?|xhtml|md|ya?ml)$/i;

  for (const file of files) {
    if (eslintPattern.test(file)) {
      eslintFiles.push(file);
    }

    if (prettierPattern.test(file)) {
      prettierFiles.push(file);
    }

    if (file.startsWith("addon/") && file.endsWith(".css")) {
      stylelintFiles.push(file);
    }
  }

  return {eslintFiles, prettierFiles, stylelintFiles};
}

async function main() {
  const files = await getStagedFiles();

  if (!files.length) return;
  const {eslintFiles, prettierFiles, stylelintFiles} = groupFiles(files);
  const msg = files.length === 1 ? "file" : "files";
  console.log(`\n${files.length} ${msg} changed, linting...`);

  const commands = [];
  // Run eslint
  if (eslintFiles.length) {
    const CONFIG_FILES_TO_WATCH = [
      "eslint.config.js",
      "package.json",
      "config/eslint-plugin-tabmix",
    ];

    const shouldClearEslintCache = stagedFiles =>
      stagedFiles.some(file =>
        CONFIG_FILES_TO_WATCH.some(configPath => file.startsWith(configPath))
      );

    if (shouldClearEslintCache(files)) {
      await rm("config/.eslintcache", {force: true});
    }

    const code = runCmd("eslint", "bin/eslint.js", [
      "--no-warn-ignored",
      "--report-unused-disable-directives",
      "--max-warnings",
      "0",
      "--cache",
      "--cache-strategy",
      "content",
      "--cache-location",
      "config/.eslintcache",
      ...eslintFiles,
    ]);
    commands.push(code);
  }

  // Run prettier
  if (prettierFiles.length) {
    const code = runCmd("prettier", "bin/prettier.cjs", [
      "--check",
      "--config",
      "config/prettier.config.js",
      "--ignore-path",
      "config/.prettierignore",
      ...prettierFiles,
    ]);
    commands.push(code);
  }

  // Run stylelint
  if (stylelintFiles.length) {
    const code = runCmd("stylelint", "bin/stylelint.mjs", [
      "--fix",
      "--config",
      "config/.stylelintrc.json",
      ...stylelintFiles,
    ]);
    commands.push(code);
  }

  const results = await Promise.all(commands);

  if (results.every(r => r.success)) {
    console.log("\n✅ All linters passed. Ready to commit!");
    process.exit(0);
  }

  for (const result of results) {
    console.log(`\n--- ${result.cmd} ---`);
    if (result.success) {
      console.log(`✅ ${result.cmd} passed`);
    } else {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.code === 1) {
        console.error(`❌ ${result.cmd} found lint issues`);
      } else {
        console.error(`💥 ${result.cmd} failed internally with exit code ${result.code}`);
      }
    }
  }

  process.exit(1);
}

main().catch(error => {
  console.error(`💥 Unexpected error: ${error.message}`);
  process.exit(1);
});
