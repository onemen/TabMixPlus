"use strict";

Tabmix.contentAreaClick = {
  init: function() {
    // this getter trigger by call to isGreasemonkeyInstalled from
    // TMP_extensionsCompatibility.onDelayedStartup
    XPCOMUtils.defineLazyGetter(Tabmix, "ContentClick", function() {
      let tmp = { };
      Cu.import("resource://tabmixplus/ContentClick.jsm", tmp);
      return tmp.TabmixContentClick;
    });

    Tabmix.changeCode(window, "contentAreaClick")._replace(
      'if (linkNode &&',
      'var {where, suppressTabsOnFileDownload, _href, targetAttr} =\n' +
      '      Tabmix.ContentClick.getParamsForLink(event, linkNode, href,\n' +
      '          gBrowser.selectedBrowser, document.commandDispatcher.focusedWindow);\n' +
      '  href = _href;\n\n' +
      '  $&'
    )._replace(
      'if (linkNode.getAttribute("onclick")',
      'if (where == "default") $&'
    )._replace(
      'loadURI(',
      'if (where == "tab" || where == "tabshifted") {\n' +
      '        let doc = event.target.ownerDocument;\n' +
      '        let _url = Tabmix.isVersion(190) ? href : url;\n' +
      '        openLinkIn(_url, where,\n' +
      '             {referrerURI: doc.documentURIObject,\n' +
      '              charset: doc.characterSet,\n' +
      '              initiatingDoc: doc,\n' +
      '              suppressTabsOnFileDownload: suppressTabsOnFileDownload});\n' +
      '      }\n' +
      '      else\n        $&'
    )._replace(
      // force handleLinkClick to use openLinkIn by replace "current"
      // with " current", we later use trim() before handleLinkClick call openLinkIn
      'handleLinkClick(event, href, linkNode);',
      'event.__where = where == "current" && href.indexOf("custombutton://") != 0 ? " " + where : where;\n' +
      '  event.__suppressTabsOnFileDownload = suppressTabsOnFileDownload;\n' +
      '  var result = $&\n' +
      '  if (targetAttr && !result)\n' +
      '    setTimeout(function(){Tabmix.ContentClick.selectExistingTab(href, targetAttr);},300);'
    ).toCode();

    /* don't change where if it is save, window, or we passed
     * event.__where = default from contentAreaClick or
     * Tabmix.contentAreaClick.contentLinkClick
     */
    Tabmix.changeCode(window, "handleLinkClick")._replace(
      'whereToOpenLink(event);',
      '$&\n' +
      '  if (event && event.__where && event.__where != "default" &&\n' +
      '      ["tab","tabshifted","current"].indexOf(where) != -1) {\n' +
      '    where = event.__where.split(".")[0];\n' +
      '  }\n'
    )._replace(
      'var doc = event.target.ownerDocument;',
      'where = where.trim();\n' +
      '  $&'
    )._replace(
      'charset: doc.characterSet',
      '$&,\n                            suppressTabsOnFileDownload: event.__suppressTabsOnFileDownload'
    ).toCode();
  },

  /**
   * @brief Handle left-clicks on links when preference is to open new tabs from links
   *        links that are not handled here go on to the page code and then to contentAreaClick
   */
  _contentLinkClick: function TMP__contentLinkClick(event) {
    Tabmix.ContentClick.contentLinkClick(event,
        gBrowser.selectedBrowser, document.commandDispatcher.focusedWindow);
  }
}
