/* eslint no-var: 2, prefer-const: 2 */
"use strict";

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  class Broadcaster extends MozXULElement {
    /** @this {BroadcasterClass} */
    connectedCallback() {
      if (this.delayConnectedCallback()) {
        return;
      }
      this.textContent = "";
      window.addEventListener("load", () => {
        try {
          const obs = Array.from(window.document.querySelectorAll(`[observes="${this.id}"]`) ?? []);
          obs.forEach(el => {
            for (let i = 0; i < this.attributes.length; i++) {
              const name = this.attributes[i]?.name;
              if (!el || !name || name === "id") break;
              el.setAttribute(name, this.attributes[i]?.value ?? "");
            }
          });
        } catch (ex) {
          console.error(ex);
        }
      }, {once: true});
      const config = {attributes: true};
      const callback = function(/** @type {MutationRecord[]} */ mutationList) {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes' && mutation.target && mutation.attributeName) {
            const name = mutation.target.hasAttribute(mutation.attributeName);
            const obs = Array.from(window.document.querySelectorAll(`[observes="${mutation.target.id}"]`) ?? []);
            for (const el of obs) {
              try {
                if (name) {
                  el?.setAttribute(mutation.attributeName, mutation.target.getAttribute(mutation.attributeName) ?? "");
                } else {
                  el?.removeAttribute(mutation.attributeName);
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
      const obs = window.document.getElementById(this.getAttribute("element") ?? "");
      const attr = this.attributes.attribute?.value;
      const el = this.parentElement;
      if (!obs || !attr || !el) {
        return;
      }
      window.addEventListener("load", () => {
        try {
          if (obs.hasAttribute(attr)) {
            el.setAttribute(attr, obs.attributes.getNamedItem(attr)?.value ?? "");
          }
        } catch (ex) {
          console.error(ex);
        }
      }, {once: true});
      const config = {attributes: true};
      const callback = function(/** @type {MutationRecord[]} */ mutationList) {
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes' && mutation.target) {
            try {
              if (mutation.target.hasAttribute(attr)) {
                if (mutation.target.getAttribute(attr) != el.getAttribute(attr))
                  el.setAttribute(attr, mutation.target.getAttribute(attr) ?? "");
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
