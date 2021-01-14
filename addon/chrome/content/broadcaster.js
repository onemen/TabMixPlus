/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class Broadcaster extends MozXULElement {
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      window.addEventListener("load", () => {
        try {
          const obs = Array.from(window.document.querySelectorAll(`[observes="${this.id}"]`));
          window.document.querySelectorAll(`observes[element="${this.id}"]`).forEach(node => obs.push(node.parentNode));
          obs.forEach(el => {
            for (let i = 0; i < this.attributes.length; i++) {
              if (this.attributes[i].name == "id") break;
              el.setAttribute(this.attributes[i].name, this.attributes[i].value);
            }
          });
        } catch (ex) {
          Cu.reportError(ex);
        }
      }, {once: true});
      const config = {attributes: true};
      const callback = function(mutationList) {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes') {
            const name = mutation.target.hasAttribute(mutation.attributeName);
            const obs = Array.from(window.document.querySelectorAll(`[observes="${mutation.target.id}"]`));
            window.document.querySelectorAll(`observes[element="${mutation.target.id}"]`).forEach(node => obs.push(node.parentNode));
            for (const el of obs) {
              try {
                if (name) {
                  el.setAttribute(mutation.attributeName, mutation.target.getAttribute(mutation.attributeName));
                } else {
                  el.removeAttribute(mutation.attributeName);
                }
              } catch (ex) {
                Cu.reportError(ex);
              }
            }
          }
        }
      };
      const observer = new MutationObserver(callback);
      observer.observe(this, config);
    }
  }

  if (customElements.get("broadcaster")) {
    customElements.define("broadcaster", Broadcaster);
  }
}
