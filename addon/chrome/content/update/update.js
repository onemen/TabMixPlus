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
    ", which is encouraging, but my monthly goal to continue development is $3,000.",
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

window.addEventListener(
  "DOMContentLoaded",
  () => {
    const chromeWin = window.browsingContext.topChromeWindow;
    const browser = window.docShell?.chromeEventHandler;
    if (!browser) return;

    // @ts-ignore
    const tab = chromeWin?.gBrowser.getTabForBrowser(browser);
    if (!tab) return;

    const {version, support} = tab?._updateData ?? {};

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
  },
  {once: true}
);
