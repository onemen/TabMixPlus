import {initializeChangeCodeClass} from "chrome://tabmix-resource/content/Changecode.sys.mjs";

/** @type {HandleOnEventModule.CreateHandleOnEvent} */
export function createHandleOnEvent(window) {
  const doc = window.document;

  /** @type {TabmixGlobal} */ // @ts-expect-error we add properties bellow
  const Tabmix = {};

  initializeChangeCodeClass(Tabmix, {obj: window});

  /** @type {HandleOnEventModule.GetFunction} */
  function getFunction(element, eventName, eventCode) {
    const key = "_evt_" + eventName; // cache key
    // @ts-ignore
    let fn = element[key];
    if (!fn) {
      const code = `function ${eventName}(event) {${eventCode}}`;
      fn = Tabmix.makeCode(code, null, "", Tabmix._sandbox);

      // @ts-ignore
      element[key] = fn;
    }
    return fn;
  }

  /**
   * Generic handler for data-evt-* attributes.
   *
   * @type {HandleOnEventModule.HandleOnEvent}
   */
  function handleOnEvent(
    event,
    eventName,
    {attrName = `data-evt-${eventName.toLowerCase()}`, element = event?.target} = {}
  ) {
    if (!element) return undefined;

    // Create synthetic event if needed
    if (!event) {
      event = doc.createEvent("Events");
      event.initEvent(eventName, true, true);
    }

    // Walk up DOM to find element with the attribute

    /** @type {typeof element | Node | null} */
    let el = element;
    while (el && Element.isInstance(el) && !el.hasAttribute(attrName)) {
      el = el.parentNode;
    }

    if (!Element.isInstance(el)) {
      return undefined;
    }

    const code = el.getAttribute(attrName);
    if (!code) return undefined;

    const fn = getFunction(el, eventName, code);
    return fn.call(el, event);
  }

  // Persistent set of event names discovered so far in this window
  const seenEventNames = new Set(["paneload", "syncfrompreference", "synctopreference"]);

  /**
   * Scan DOM for data-evt-* attributes and register window-level delegated
   * listeners for new event types.
   */
  function discoverEventTypes() {
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);

    /** @type {Node | null} */
    let node = walker.currentNode;

    while (node) {
      for (const key in node.dataset) {
        if (key.startsWith("evt")) {
          const eventName = key.slice(3).toLowerCase();

          if (!seenEventNames.has(eventName)) {
            seenEventNames.add(eventName);
            window.addEventListener(
              eventName,
              (/** @type {Event} */ event) => handleOnEvent(event, eventName),
              {capture: true}
            );
          }
        }
      }

      node = walker.nextNode();
    }
  }

  return {getFunction, handleOnEvent, discoverEventTypes};
}
