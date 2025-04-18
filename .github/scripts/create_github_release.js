#!/usr/bin/env node

import {execSync} from "node:child_process";

// Use the same environment variable that's set in the workflow
const changelogExists = process.env.CHANGELOG_EXIST === "true";
const previousTag = process.env.PREVIOUS_TAG;
const notes = process.env.NOTES;
const xpiName = process.env.XPI_NAME;

console.log("Script environment variables:");
console.log(`- CHANGELOG_EXIST: ${process.env.CHANGELOG_EXIST} (parsed as: ${changelogExists})`);
console.log(`- PREVIOUS_TAG: ${previousTag}`);
console.log(`- NOTES: ${notes}`);
console.log(`- XPI_NAME: ${xpiName}`);

let updateNotesCommand = "gh release edit dev-build --draft=false";
if (changelogExists) {
  console.log("Changelog exists, using CHANGELOG.md for release notes");
  updateNotesCommand += " --notes-file=CHANGELOG.md";
} else {
  console.log("No changelog exists, using default notes");
  // No changes since last tag
  const url = `https://github.com/onemen/TabMixPlus/releases/tag/${previousTag}`;
  const releaseNotes = `${notes}<br /><br />No changes since [${previousTag}](${url})`;
  updateNotesCommand += ` --notes="${releaseNotes}"`;
  console.log(`Generated release notes: ${releaseNotes}`);
}

console.log(`Executing command: ${updateNotesCommand}`);
// Update release notes
execSync(updateNotesCommand, {stdio: "inherit"});

const uploadCommand = `gh release upload dev-build /tmp/${xpiName}.xpi --clobber`;
console.log(`Uploading XPI file: ${uploadCommand}`);
// Upload XPI file
execSync(uploadCommand, {
  stdio: "inherit",
});

console.log("GitHub release update completed successfully");
