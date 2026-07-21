"use strict";

const {Downloads} = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
const {NetUtil} = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");

const FX_FOLDER_URL =
  "https://github.com/onemen/TabMixPlus/releases/download/dev-build/fx-folder.zip";
const UTILS_URL = "https://github.com/onemen/TabMixPlus/releases/download/dev-build/utils.zip";
const FX_FOLDER_FILENAME = "fx-folder.zip";
const UTILS_FILENAME = "utils.zip";

/** @param {string} msg @param {boolean} [showRestart] */
function showStatus(msg, showRestart = false) {
  const statusEl = document.getElementById("install-status");
  const textEl = document.getElementById("install-status-text");
  const restartBtn = document.getElementById("btn-restart");
  if (statusEl && textEl) {
    statusEl.hidden = false;
    if (textEl.textContent) {
      textEl.append("\n" + msg);
    } else {
      textEl.textContent = msg;
    }
  }
  if (restartBtn) {
    restartBtn.hidden = !showRestart;
  }
}

function clearStatus() {
  const textEl = document.getElementById("install-status-text");
  const statusEl = document.getElementById("install-status");
  const restartBtn = document.getElementById("btn-restart");
  if (textEl) {
    textEl.textContent = "";
  }
  if (statusEl) {
    statusEl.hidden = true;
  }
  if (restartBtn) {
    restartBtn.hidden = true;
  }
}

/** @param {string} msg @param {unknown} err */
function logError(msg, err) {
  console.error(`Tab Mix Plus: ${msg}`, err);
}

async function getDownloadsDir() {
  return Downloads.getPreferredDownloadsDirectory();
}

/** @param {string} url @param {string} targetPath @param {string} label */
async function downloadFile(url, targetPath, label) {
  showStatus(`Downloading ${label}...`);
  await Downloads.fetch(url, targetPath);
}

async function downloadConfigFiles() {
  const btn = document.getElementById("btn-download-config");
  if (btn) {
    btn.disabled = true;
  }
  try {
    clearStatus();
    const downloadsDir = await getDownloadsDir();
    const fxPath = PathUtils.join(downloadsDir, FX_FOLDER_FILENAME);
    await downloadFile(FX_FOLDER_URL, fxPath, "config files");
    showStatus("Config files downloaded to your Downloads folder.");
    showStatus("Extract fx-folder.zip and copy files to your Firefox directory:");
    showStatus("  config.js  →  [Firefox root directory]");
    showStatus("  config-prefs.js  →  [Firefox root directory]/defaults/pref/");
  } catch (err) {
    logError("download config files", err);
    showStatus("Download failed. Check your internet connection and try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}

async function downloadUtilsFiles() {
  const btn = document.getElementById("btn-download-utils");
  if (btn) {
    btn.disabled = true;
  }
  try {
    clearStatus();
    const downloadsDir = await getDownloadsDir();
    const utilsPath = PathUtils.join(downloadsDir, UTILS_FILENAME);
    await downloadFile(UTILS_URL, utilsPath, "utils");
    showStatus("Utils downloaded to your Downloads folder.");
  } catch (err) {
    logError("download utils", err);
    showStatus("Download failed. Check your internet connection and try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}

async function installUtils() {
  const btn = document.getElementById("btn-install-utils");
  if (btn) {
    btn.disabled = true;
  }
  try {
    clearStatus();
    const downloadsDir = await getDownloadsDir();
    const utilsPath = PathUtils.join(downloadsDir, UTILS_FILENAME);

    if (!(await IOUtils.exists(utilsPath))) {
      await downloadFile(UTILS_URL, utilsPath, "utils");
    }

    showStatus("Installing utils...");

    const zipFile = await IOUtils.getFile(utilsPath);
    const zipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    zipReader.open(zipFile);

    const profileDir = Services.dirsvc.get("ProfD", Ci.nsIFile);
    const chromeDir = PathUtils.join(profileDir.path, "chrome");
    const utilsDir = PathUtils.join(chromeDir, "utils");

    if (!(await IOUtils.exists(chromeDir))) {
      await IOUtils.makeDirectory(chromeDir);
    }
    if (!(await IOUtils.exists(utilsDir))) {
      await IOUtils.makeDirectory(utilsDir);
    }

    const entries = zipReader.findEntries("*?*");
    // @ts-ignore - nsIUTF8StringEnumerator iterator
    for (let entryName of entries) {
      const entry = zipReader.getEntry(entryName);
      if (entry.isDirectory) {
        const dirPath = PathUtils.join(utilsDir, ...entryName.split("/").filter(Boolean));
        if (!(await IOUtils.exists(dirPath))) {
          await IOUtils.makeDirectory(dirPath, {createAncestors: true});
        }
      } else {
        const parts = entryName.split("/").filter(Boolean);
        const targetPath = PathUtils.join(utilsDir, ...parts);
        const targetFile = await IOUtils.getFile(targetPath);
        const targetFileDir = targetFile.parent;
        if (!targetFileDir.exists()) {
          await IOUtils.makeDirectory(targetFileDir.path, {createAncestors: true});
        }
        const inputStream = zipReader.getInputStream(entryName);
        const outputStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(
          Ci.nsIFileOutputStream
        );
        outputStream.init(targetFile, -1, -1, Ci.nsIFileOutputStream.DEFER_OPEN);
        await new Promise((resolve, reject) => {
          NetUtil.asyncCopy(inputStream, outputStream, statusCode => {
            outputStream.close();
            if (Components.isSuccessCode(statusCode)) {
              // @ts-ignore Promise<void> resolve
              resolve();
            } else {
              reject(new Error(`Failed to write ${entryName}`));
            }
          });
        });
      }
    }
    zipReader.close();
    // wait a moment for the OS to release the file lock
    await new Promise(r => setTimeout(r, 100));
    try {
      await IOUtils.remove(utilsPath, {ignoreAbsent: true});
    } catch {
      // file may still be locked
    }

    showStatus("Utils installed successfully!");

    const configSection = document.getElementById("config-section");
    if (configSection && !configSection.hidden) {
      showStatus(
        "You still need to install config files manually.\n" +
          "Download config files, extract fx-folder.zip, and copy files to your Firefox directory."
      );
      showStatus("After installing config files, restart Firefox to apply changes.", true);
    } else {
      showStatus("Restart Firefox to apply changes.", true);
    }

    const remindBtn = document.getElementById("btn-remind-tomorrow");
    if (remindBtn) {
      remindBtn.hidden = true;
    }
  } catch (err) {
    logError("install utils", err);
    showStatus("Failed to install utils. Please try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}

function closeUpdateTab() {
  try {
    const chromeWin = window.browsingContext.topChromeWindow;
    const browser = window.docShell?.chromeEventHandler;
    if (browser && chromeWin) {
      // @ts-ignore
      const tab = chromeWin.gBrowser.getTabForBrowser(browser);
      if (tab) {
        chromeWin.gBrowser.removeTab(tab);
      }
    }
  } catch {
    // tab may already be closed
  }
}

function restartFirefox() {
  closeUpdateTab();
  Services.appinfo.invalidateCachesOnRestart();
  const cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
  Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");
  if (cancelQuit.data) {
    return;
  }
  Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
}

/** @param {{users: string; amount: string; date: string}} support */
function setSupportMessage({users, amount, date}) {
  /** @type {HTMLElement} */ // @ts-ignore
  const container = document.getElementById("dynamic-support-msg");
  container.textContent = ""; // Clear existing

  const parts = [
    "Special thank you for the ",
    {tag: "strong", text: `${users} users`},
    " who supported me with the amount of ",
    {tag: "strong", text: `$${amount}`},
    " in ",
    {tag: "strong", text: date},
    ", which is encouraging, but my monthly goal to continue development is ",
    {tag: "strong", text: "$3,000"},
    ".",
  ];

  parts.forEach(part => {
    if (typeof part === "string") {
      container.appendChild(document.createTextNode(part));
    } else {
      const el = document.createElement(part.tag);
      el.textContent = part.text;
      container.appendChild(el);
    }
  });
}

/** @param {string} dateStr - "YYYY-MM-DD" */
function formatScriptsDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(date.getTime())) return null;
  return {
    short: date.toLocaleDateString("en-US", {year: "numeric", month: "short", day: "numeric"}),
    long: date.toLocaleDateString("en-US", {year: "numeric", month: "long", day: "numeric"}),
  };
}

/** @param {string} timeId @param {string} dateStr */
function setScriptsDate(timeId, dateStr) {
  const timeEl = document.getElementById(timeId);
  if (!timeEl) return;
  const formatted = formatScriptsDate(dateStr);
  if (!formatted) {
    timeEl.hidden = true;
    return;
  }
  timeEl.setAttribute("datetime", dateStr);
  timeEl.setAttribute("title", `Updated ${formatted.short}`);
  timeEl.setAttribute("aria-label", `Updated ${formatted.long}`);
  // @ts-ignore
  timeEl.textContent = `Updated ${formatted.short}`;
  timeEl.hidden = false;
}

window.addEventListener(
  "DOMContentLoaded",
  () => {
    const chromeWin = window.browsingContext.topChromeWindow;
    if (!chromeWin) return;
    const browser = window.docShell?.chromeEventHandler;
    if (!browser) return;

    // @ts-ignore
    const tab = chromeWin?.gBrowser.getTabForBrowser(browser);
    if (!tab) return;

    const {version, support, showScriptsUpdate, scriptsInfo} = tab?._updateData ?? {};

    // update title
    const versionTitleSpan = document.getElementById("version-title-span");

    if (versionTitleSpan && version) {
      const versionString = version.includes("-") ? version.split("-")[0] + " dev-build" : version;
      versionTitleSpan.textContent = "Version ";
      const span = document.createElement("span");
      span.className = "animated-title gradient-text font-bold";
      span.textContent = versionString;
      versionTitleSpan.appendChild(span);
      versionTitleSpan.appendChild(document.createTextNode(" Installed"));
    }

    // support message
    if (support) {
      setSupportMessage(support);
    }

    if (showScriptsUpdate) {
      const layout = document.querySelector(".layout");
      if (layout) {
        layout.classList.add("visible-aside");
      }
      if (!version) {
        if (layout) {
          layout.classList.add("scripts-update-only");
        }
        document.title = "Tab Mix Plus - Scripts Update";
        const remindBtn = document.getElementById("btn-remind-tomorrow");
        if (remindBtn) {
          remindBtn.hidden = false;
        }
      }

      // show only sections that need update, with per-file dates
      const configSection = document.getElementById("config-section");
      const utilsSection = document.getElementById("utils-section");
      const fxFolderInfo = scriptsInfo?.fxFolder;
      const utilsInfo = scriptsInfo?.utils;

      if (configSection && fxFolderInfo) {
        configSection.hidden = !fxFolderInfo.updateNeeded;
        setScriptsDate("config-update-date", fxFolderInfo.date);
      }
      if (utilsSection && utilsInfo) {
        utilsSection.hidden = !utilsInfo.updateNeeded;
        setScriptsDate("utils-update-date", utilsInfo.date);
      }

      const skipConfig = /** @type {HTMLInputElement | null} */ (
        document.getElementById("skip-config")
      );
      const skipUtils = /** @type {HTMLInputElement | null} */ (
        document.getElementById("skip-utils")
      );
      if (skipConfig && fxFolderInfo?.remoteHash) {
        skipConfig.addEventListener("change", () => {
          if (skipConfig.checked) {
            chromeWin.Tabmix.prefs.setCharPref("skippedHash.fx-folder", fxFolderInfo.remoteHash);
          } else {
            chromeWin.Tabmix.prefs.clearUserPref("skippedHash.fx-folder");
          }
        });
      }
      if (skipUtils && utilsInfo?.remoteHash) {
        skipUtils.addEventListener("change", () => {
          if (skipUtils.checked) {
            chromeWin.Tabmix.prefs.setCharPref("skippedHash.utils", utilsInfo.remoteHash);
          } else {
            chromeWin.Tabmix.prefs.clearUserPref("skippedHash.utils");
          }
        });
      }
    }

    const btnDownloadConfig = document.getElementById("btn-download-config");
    const btnDownloadUtils = document.getElementById("btn-download-utils");
    const btnInstallUtils = document.getElementById("btn-install-utils");
    const btnRestart = document.getElementById("btn-restart");
    const btnRemind = document.getElementById("btn-remind-tomorrow");

    if (btnDownloadConfig) {
      btnDownloadConfig.addEventListener("click", () => {
        downloadConfigFiles();
      });
    }
    if (btnDownloadUtils) {
      btnDownloadUtils.addEventListener("click", () => {
        downloadUtilsFiles();
      });
    }
    if (btnInstallUtils) {
      btnInstallUtils.addEventListener("click", () => {
        installUtils();
      });
    }
    if (btnRestart) {
      btnRestart.addEventListener("click", () => {
        restartFirefox();
      });
    }
    if (btnRemind) {
      btnRemind.addEventListener("click", () => {
        const today = new Date(performance.timeOrigin + performance.now())
          .toISOString()
          .slice(0, 10);
        chromeWin.Tabmix.prefs.setCharPref("lastScriptsCheckDate", today);
        closeUpdateTab();
      });
    }
  },
  {once: true}
);
