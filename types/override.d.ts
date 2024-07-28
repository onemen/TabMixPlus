// reference this file before "./gecko/lib.gecko.dom.d.ts"
// to override `namespace ChromeUtils`

// @ts-expect-error - override `namespace ChromeUtils` from `gecko/lib.gecko.dom.d.ts`
interface ChromeUtils {
  defineLazyGetter(aTarget: any, aName: any, aLambda: any): void;
  defineModuleGetter: (target: any, variable: string, path: string) => void;
  defineESModuleGetters: (target: any, mappings: any) => void;
  generateQI(interfaces: any[]): MozQueryInterface;
  getClassName(obj: any, unwrap?: boolean): string;
  import(aResourceURI: string): any;
  importESModule(aResourceURI: string): any;
  nondeterministicGetWeakSetKeys(aSet: any): any;
}

// @ts-expect-error - override `namespace ChromeUtils` from `gecko/lib.gecko.dom.d.ts`
declare var ChromeUtils: ChromeUtils;
