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
          obs.forEach(el => {
            for (let i = 0; i < this.attributes.length; i++) {
              if (this.attributes[i].name == "id") break;
              el.setAttribute(this.attributes[i].name, this.attributes[i].value);
            }
          });
        } catch (ex) {
          console.error(ex);
        }
      }, {once: true});
      const config = {attributes: true};
      const callback = function(mutationList) {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes') {
            const name = mutation.target.hasAttribute(mutation.attributeName);
            const obs = Array.from(window.document.querySelectorAll(`[observes="${mutation.target.id}"]`));
            for (const el of obs) {
              try {
                if (name) {
                  el.setAttribute(mutation.attributeName, mutation.target.getAttribute(mutation.attributeName));
                } else {
                  el.removeAttribute(mutation.attributeName);
                }
              } catch (ex) {
                console.error(ex);
              }
            }
          }
        }
      };
      const observer = new MutationObserver(callback);
      observer.observe(this, config);
    }
  }

  class Observes extends MozXULElement {
    connectedCallback() {
      // super();
      this.textContent = "";
      const obs = window.document.getElementById(this.getAttribute("element"));
      const attr = this.attributes.attribute.value;
      const el = this.parentElement;
      window.addEventListener("load", () => {
        try {
          if (obs.hasAttribute(attr))
            el.setAttribute(attr, obs.attributes[attr].value);
        } catch (ex) {
          console.error(ex);
        }
      }, {once: true});
      const config = {attributes: true};
      const callback = function(mutationList) {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes') {
            try {
              if (mutation.target.hasAttribute(attr)) {
                if (mutation.target.getAttribute(attr) != el.getAttribute(attr))
                  el.setAttribute(attr, mutation.target.getAttribute(attr));
              } else {
                el.removeAttribute(attr);
              }
            } catch (ex) {
              console.error(ex);
            }
          }
        }
      };
      const observer = new MutationObserver(callback);
      observer.observe(obs, config);
    }
  }

  if (!customElements.get("broadcaster")) {
    customElements.define("broadcaster", Broadcaster);
  }

  if (!customElements.get("observes")) {
    customElements.define("observes", Observes);
  }
}
