import {isVersion} from "./BrowserVersion.sys.mjs";

// @ts-expect-error - type are in modules.d.ts GlobalAccessModule
export function getGlobal(node) {
  if (!node) return null;
  return isVersion(1520) ? node.documentGlobal : node.ownerGlobal;
}

/** @type {GlobalAccessModule.GlobalKey} */
export const globalKey = isVersion(1520) ? "documentGlobal" : "ownerGlobal";
