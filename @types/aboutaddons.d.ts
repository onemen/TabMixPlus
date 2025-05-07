/// <reference types="./gecko/tools/generated/lib.gecko.xpcom.d.ts" />

interface WindowProxy {
  readonly docShell: nsIDocShell;
}

declare var windowRoot: WindowRoot & {readonly ownerGlobal: WindowProxy};
