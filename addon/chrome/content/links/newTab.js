"use strict";

(function Tabmix_newTab() {
  function updateTitle() {
    if (!gGrid.cells)
      return;
    let win = Tabmix.getTopWin();
    if (win)
      win.TMP_Places._titlefrombookmark = Tabmix.prefs.getBoolPref("titlefrombookmark");
    gGrid.cells.forEach(function (cell) {
      let site = cell.site;
      if (!site)
        return;
      let url = site.url;
      let title = site.title || url;
      title = win.TMP_Places.getTitleFromBookmark(url, title);
      let tooltip = (title == url ? title : title + "\n" + url);
      let link = site._querySelector(".newtab-link");
      link.setAttribute("title", tooltip);
      site._querySelector(".newtab-title").textContent = title;
    });
  }

  let win = Tabmix.getTopWin();
  if (win && win.Tabmix && win.Tabmix.initialization.onWindowOpen.initialized) {
    Services.prefs.addObserver("extensions.tabmix.titlefrombookmark", updateTitle, false);
    window.addEventListener("unload", function TMP_removeObserver(aEvent) {
      aEvent.currentTarget.removeEventListener("unload", TMP_removeObserver, false);
      Services.prefs.removeObserver("extensions.tabmix.titlefrombookmark", updateTitle);
    }, false);
    if (Tabmix.prefs.getBoolPref("titlefrombookmark"))
      updateTitle();
  }

})();
