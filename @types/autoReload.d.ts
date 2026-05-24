/// <reference types="./numberinput.d.ts" />

declare var gNumberInput: typeof NumberInput;
declare function AdjustPopupWidth(event: ReloadWindowEvent): void;
declare function Oninput(event: Event & {target: HTMLNumberInputElement}): void;
declare function OpenPopup(event: ReloadWindowEvent): void;

type ReloadWindowEvent = Event & {target: Target};
type Target = HTMLButtonElement & {nextElementSibling: XULPopupElement};

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
