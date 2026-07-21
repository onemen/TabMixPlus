"use strict";

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

/** @param {string | null | undefined} scriptsUpdateDate */
function setUpdateTime(scriptsUpdateDate) {
  const time = document.querySelector("time.date-badge");
  if (!time) {
    return;
  }

  if (scriptsUpdateDate) {
    const parts = scriptsUpdateDate.split("-");
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (parts.length === 3 && !isNaN(date.getTime())) {
      const shortDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const longDate = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      time.setAttribute("datetime", scriptsUpdateDate);
      time.setAttribute("title", `Updated ${shortDate}`);
      time.setAttribute("aria-label", `Updated ${longDate}`);
      // @ts-ignore
      time.lastChild.textContent = `Updated ${shortDate}`;
      return;
    }
  }
  time.hidden = true;
}

window.addEventListener(
  "DOMContentLoaded",
  () => {
    const chromeWin = window.browsingContext.topChromeWindow;
    const browser = window.docShell?.chromeEventHandler;
    if (!browser) return;

    // @ts-ignore
    const tab = chromeWin?.gBrowser.getTabForBrowser(browser);
    if (!tab) return;

    const {version, support, showScriptsUpdate, scriptsUpdateDate} = tab?._updateData ?? {};

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
      document.querySelector(".layout")?.classList.add("visible-aside");
      setUpdateTime(scriptsUpdateDate);
    }
  },
  {once: true}
);
