#!/usr/bin/env node

import fs from "node:fs";

console.log("Starting version calculation...");

const previousTag = process.argv[2];
console.log(`Previous tag: ${previousTag}`);

const tagVersion = previousTag.substring(1); // Remove 'v' prefix
console.log(`Tag version (without 'v' prefix): ${tagVersion}`);

function nextVersion(versionStr) {
  console.log(`Calculating next version from: ${versionStr}`);

  // Check if it's a pre-release version
  const preReleaseMatch = versionStr.match(/^([0-9]+\.[0-9]+\.[0-9]+-pre\.)([0-9]+)$/);
  if (preReleaseMatch) {
    const prefix = preReleaseMatch[1];
    const number = parseInt(preReleaseMatch[2], 10);
    const preReleaseResult = `${prefix}${number + 1}`;
    console.log(`Pre-release version detected. Incrementing ${number} to ${number + 1}`);
    console.log(`New version: ${preReleaseResult}`);
    return preReleaseResult;
  }

  // Regular version
  const parts = versionStr.split(".");
  console.log(`Version parts: ${parts.join(", ")}`);

  const oldPatch = parseInt(parts[parts.length - 1], 10);
  const newPatch = oldPatch + 1;
  parts[parts.length - 1] = newPatch.toString();

  const result = parts.join(".");
  console.log(`Regular version detected. Incrementing patch from ${oldPatch} to ${newPatch}`);
  console.log(`New version: ${result}`);
  return result;
}

const newVersion = nextVersion(tagVersion);
console.log(`Final new version: ${newVersion}`);

const date = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", ".");
console.log(`Generated date string: ${date}`);

// Read install.rdf
const installRdfPath = "addon/install.rdf";
console.log(`Reading file: ${installRdfPath}`);
let installRdf;
try {
  installRdf = fs.readFileSync(installRdfPath, "utf8");
  console.log(`Successfully read ${installRdf.length} characters from ${installRdfPath}`);
} catch (error) {
  console.error(`Error reading ${installRdfPath}: ${error.message}`);
  process.exit(1);
}

// Replace version and update URL
console.log("Replacing version and update URL in install.rdf");
const versionWithDate = `${newVersion}-${date}`;
console.log(`New version with date: ${versionWithDate}`);

const originalInstallRdf = installRdf;
installRdf = installRdf
  .replace(/10\.0\.0-unbundeled/, versionWithDate)
  .replace(/updates\.json/, "updates-dev-build.json");

if (originalInstallRdf === installRdf) {
  console.warn("Warning: No replacements were made in install.rdf");
} else {
  console.log("Successfully replaced version and update URL in install.rdf");
}

// Write back to file
console.log(`Writing updated content back to ${installRdfPath}`);
try {
  fs.writeFileSync(installRdfPath, installRdf);
  console.log(`Successfully wrote ${installRdf.length} characters to ${installRdfPath}`);
} catch (error) {
  console.error(`Error writing to ${installRdfPath}: ${error.message}`);
  process.exit(1);
}

console.log(`next version: ${newVersion}-${date}`);
console.log("Version calculation completed successfully");
