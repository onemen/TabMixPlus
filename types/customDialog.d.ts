interface Element {
  getButton(buttonId: string): HTMLButtonElement;
  set defaultButton(buttonId: string);
  get defaultButton(): string;
  label: string;
}

interface HTMLMenuElement {
  selectedItem: HTMLElement;
  readonly defaultIndex: number;
  set selectedIndex(value: number);
  get selectedIndex(): number;
}

declare function moveToAlertPosition(): void;
declare function centerWindowOnScreen(): void;

interface Window {
  arguments: any[];
  _callBackFunction?: (data: {button: number; checked: boolean; label: string; value: number}) => void;
}

interface GetByMap {
  checkboxContainer: HTMLElement;
  space_before_checkbox: HTMLElement;
  tm_info: HTMLElement;
  tm_checkbox: HTMLInputElement;
  tm_prompt: HTMLMenuElement & {selectedItem: HTMLElement & {session?: string; fileName: string; value: string}};
  tm_prompt_menu: XULPopupElement;
  tm_textbox: HTMLInputElement;
}
