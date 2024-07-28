interface Element {
  getButton(buttonId: string): HTMLButtonElement;
  set defaultButton(buttonId: string);
  get defaultButton(): string;
}

interface HTMLButtonElement {
  label?: string;
}

interface HTMLMenuElement {
  selectedItem: HTMLElement;
  readonly defaultIndex: number;
  set selectedIndex(value: number);
  get selectedIndex(): number;
}

declare var moveToAlertPosition: any;
declare var centerWindowOnScreen: any;

interface Window {
  arguments: any[];
  _callBackFunction?: (data: {button: number; checked: boolean; label: string; value: number}) => void;
}
