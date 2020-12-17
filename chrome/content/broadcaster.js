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
            const config = { attributes: true };
            const callback = function (mutationList, observer) {
                for (const mutation of mutationList) {
                    if (mutation.type === 'attributes') {
                        for (let el of document.querySelectorAll("[observes=" + this.id + "]")) {
                            try {
                                this.hasAttribute(mutation.attributeName) ? el.setAttribute(mutation.attributeName, this.getAttribute(mutation.attributeName))
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
