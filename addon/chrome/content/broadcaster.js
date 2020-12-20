/* This Source Code Form is subject to the terms of the Mozilla Public
  * License, v. 2.0. If a copy of the MPL was not distributed with this
  * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
                    let obs = Array.from(window.document.querySelectorAll(`[observes="${this.id}"]`));
                    window.document.querySelectorAll(`observes[element="${this.id}"]`).forEach(node=>obs.push(node.parentNode));
                    obs.forEach(el=>{
                        for(let i = 0;i < this.attributes.length; i++){
                            if(this.attributes[i].name == "id") break;
                            el.setAttribute(this.attributes[i].name,this.attributes[i].value);
                        }
                    });
                } catch (ex) {
                  Cu.reportError(ex);
                }
              }, {once: true});
            const config = { attributes: true };
            const callback = function (mutationList, observer) {
                for (const mutation of mutationList) {
                    if (mutation.type === 'attributes') {
                        let a = mutation.target.hasAttribute(mutation.attributeName);
                        let obs = Array.from(window.document.querySelectorAll(`[observes="${mutation.target.id}"]`));
                        window.document.querySelectorAll(`observes[element="${mutation.target.id}"]`).forEach(node=>obs.push(node.parentNode));
                        for (let el of obs) {
                            try {
                                a ? el.setAttribute(mutation.attributeName, mutation.target.getAttribute(mutation.attributeName))
                                    : el.removeAttribute(mutation.attributeName);
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

    customElements.define("broadcaster", Broadcaster);

}
