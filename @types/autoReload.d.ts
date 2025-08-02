/// <reference types="./numberinput.d.ts" />

declare var gNumberInput: typeof NumberInput;

interface DocumentElement extends Omit<HTMLDialogElement, "addEventListener" | "removeEventListener"> {}

interface GetByMap {
  autoreload_minutes: HTMLNumberInputElement;
  autoreload_seconds: HTMLNumberInputElement;
  reloadevery_custom_dialog: HTMLDialogElement & {readonly shadowRoot: ShadowRoot};
}

interface GetClosestMap {
  ".combined-element": HTMLElement & {firstChild: HTMLNumberInputElement};
  ".container": HTMLElement;
}

// @ts-ignore
interface WindowProxy {
  arguments: any[];
}
