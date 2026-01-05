#!/usr/bin/env node

import fs from "node:fs";

async function updateFirefoxVersionInfo() {
  const firefoxVersionsURL = "https://product-details.mozilla.org/1.0/firefox_versions.json";
  try {
    console.log(`Fetching Firefox version from ${firefoxVersionsURL}`);
    const response = await fetch(firefoxVersionsURL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const latestVersion = parseInt(data.LATEST_FIREFOX_VERSION ?? "0");

    if (latestVersion > 0) {
      console.log(`Latest Firefox version: ${latestVersion}`);
      const updateXhtmlPath = "addon/chrome/content/update/update.xhtml";
      let content = fs.readFileSync(updateXhtmlPath, "utf8");

      const v = latestVersion;
      const replacement = `\n          Tested on Firefox versions ${v}, ${v + 1} (<span class="highlight">Beta</span>) and ${v + 2} (<span\n            class="highlight"\n            >Nightly</span\n          >)\n        `;

      const regex = /(<p id="firefox-version-info">)([\s\S]*?)(<\/p>)/;
      const newContent = content.replace(regex, `$1${replacement}$3`);

      fs.writeFileSync(updateXhtmlPath, newContent);
      console.log(`Updated ${updateXhtmlPath} with Firefox versions: ${v}, ${v + 1}, ${v + 2}`);
    } else {
      console.error("LATEST_FIREFOX_VERSION is missing in data:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Failed to update Firefox version info:", error);
  }
}
await updateFirefoxVersionInfo();
