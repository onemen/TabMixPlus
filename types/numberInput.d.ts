interface CustomEvent extends MouseEvent, KeyboardEvent {
  target: HTMLNumberInputElement;
}

interface HTMLNumberInputElement extends Omit<HTMLInputElement, "min" | "max" | "defaultValue" | "oninput" | "value"> {
  defaultValue: number | string;
  readonly editor: nsIEditor;
  min: number;
  max: number;
  value: number | string;
  oninput(e: CustomEvent): void;
}

declare namespace NumberInput {
  function init(delay?: boolean): void;
  function unload(): void;
  function changeExpr(event: CustomEvent): boolean;
  function inputExpr(event: CustomEvent): boolean;
  function handleEvent(event: CustomEvent): void;
  function updateAllSpinners(): void;
  function updateSpinnerDisabledState(item: HTMLNumberInputElement): void;
}

interface QuerySelectorMap {
  "input[type=number]": HTMLNumberInputElement;
}

interface XULPopupElement {
  openPopup(anchorElement?: Node | HTMLElement | null, options?: StringOrOpenPopupOptions, x?: number, y?: number, isContextMenu?: boolean, attributesOverride?: boolean, triggerEvent?: Event | null): void;
}

declare namespace Globals {
  function oninput(item: HTMLNumberInputElement): void;
  function onSelect(event: CustomEvent): void;
  function openPopup(button: HTMLButtonElement & {nextElementSibling: XULPopupElement}): void;
}

type NumberInput = typeof NumberInput;
