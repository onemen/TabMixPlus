"use strict";

function loadUpdateVersion() {
  const version = window.arguments?.[0];
  const updateUrl = "https://onemen.github.io/tabmixplus-docs/version_update";

  /** @type {Browser & HTMLElement} */ // @ts-ignore
  const browser = document.getElementById("tmp-update-browser");

  if (version) {
    const {AppConstants} = ChromeUtils.importESModule(
      "resource://gre/modules/AppConstants.sys.mjs"
    );

    const info = [
      Services.appinfo.name,
      Services.appinfo.platformVersion,
      AppConstants.MOZ_APP_VERSION_DISPLAY,
    ].join(",");

    browser.setAttribute("src", `${updateUrl}/?version=${version}&info=${info}`);
  } else {
    browser.setAttribute("src", updateUrl);
  }

  window.addEventListener("DOMContentLoaded", () => handleContentEvents(browser), {once: true});
}

/** @param {Browser & HTMLElement} browser */
function handleContentEvents(browser) {
  const contentScript = `
    if (content.document.readyState === "complete" || content.document.readyState === "interactive") {
      sendAsyncMessage("tabmix:DOMContentLoaded");
    } else {
      addEventListener("DOMContentLoaded", e => {
        sendAsyncMessage("tabmix:DOMContentLoaded");
      });
    }

    addEventListener("click", e => {
      const a = e.target.closest("a");
      if (!a || a.target !== "_blank") return;
      e.preventDefault();
      sendAsyncMessage("tabmix:OpenTab", {url: a.href});
    });
  `;

  const scriptUrl = "data:, " + encodeURIComponent(contentScript);
  browser.messageManager.loadFrameScript(scriptUrl, true);

  browser.messageManager.addMessageListener("tabmix:DOMContentLoaded", () => {
    document.getElementById("tmp-update-message")?.remove();
    browser.removeAttribute("hidden");
  });

  browser.messageManager.addMessageListener("tabmix:OpenTab", msg => {
    window.opener?.openTrustedLinkIn(msg.data.url, "tab");
    if (msg.data.url.includes("ko-fi.com")) {
      window.close();
    }
  });
}

loadUpdateVersion();
