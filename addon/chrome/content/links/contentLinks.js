"use strict";

Tabmix.contentAreaClick = {
  init() {
    // this getter trigger by call to isGreasemonkeyInstalled from
    // TMP_extensionsCompatibility.onDelayedStartup
    ChromeUtils.defineLazyGetter(Tabmix, "ContentClick", () => {
      return ChromeUtils.importESModule("chrome://tabmix-resource/content/ContentClick.sys.mjs")
        .TabmixContentClick;
    });

    Tabmix.changeCode(window, "contentAreaClick")
      ._replace(
        /if \(\n*\s*linkNode &&/,
        `let {where, _href, suppressTabsOnFileDownload, targetAttr} =
    Tabmix.ContentClick.getParamsForLink(event, linkNode, href,
    gBrowser.selectedBrowser, document.commandDispatcher.focusedWindow);
    href = _href;

  $&`
      )
      ._replace(/if \(\n*\s*linkNode\.getAttribute\("onclick"\)/, 'if (where == "default") $&')
      ._replace(
        "openLinkIn(",
        `if (where == "tab" || where == "tabshifted") {
        let doc = event.target.ownerDocument;
        let params = { charset: doc.characterSet, initiatingDoc: doc,
                       suppressTabsOnFileDownload: suppressTabsOnFileDownload,
                       referrerURI: doc.documentURIObject };
        params.referrerPolicy = doc.referrerPolicy;
        params.noReferrer = BrowserUtils.linkHasNoReferrer(linkNode);
        openLinkIn(href, where, params);
      }
      else
      $&`
      )
      ._replace(
        // force handleLinkClick to use openLinkIn by replace "current"
        // with " current", we later use trim() before handleLinkClick call openLinkIn
        "handleLinkClick(event, href, linkNode);",
        `event.__where = where == "current" && !href.startsWith("custombutton://") ? " " + where : where;
  event.__suppressTabsOnFileDownload = suppressTabsOnFileDownload;
  let result = $&
  if (targetAttr && !result) {
    setTimeout(function () {
      Tabmix.ContentClick.selectExistingTab(window, href, targetAttr);
    }, 300);
  }`
      )
      .toCode();

    /* don't change where if it is save, window, or we passed
     * event.__where = default from contentAreaClick or
     * Tabmix.contentAreaClick.contentLinkClick
     */
    Tabmix.changeCode(window, "handleLinkClick")
      ._replace(
        "{",
        `{
  if (arguments.length > 3) event.__where = arguments[3] && arguments[3].where;`
      )
      ._replace(
        "whereToOpenLink(event);",
        `$&
  if (
    event &&
    event.__where &&
    event.__where != "default" &&
    ["tab", "tabshifted", "current"].indexOf(where) != -1
  ) {
    where = event.__where.split(".")[0];
  }`
      )
      ._replace("var doc = event.target.ownerDocument;", "where = where.trim();\n  $&")
      ._replace(
        "charset: doc.characterSet",
        `$&,
    suppressTabsOnFileDownload: event.__suppressTabsOnFileDownload`
      )
      .toCode();
  },

  /**
   * Handle left-clicks on links when preference is to open new tabs from links
   * links that are not handled here go on to the page code and then to
   * contentAreaClick
   */
  _contentLinkClick: function TMP__contentLinkClick(event) {
    Tabmix.ContentClick.contentLinkClick(
      event,
      gBrowser.selectedBrowser,
      document.commandDispatcher.focusedWindow
    );
  },
};
