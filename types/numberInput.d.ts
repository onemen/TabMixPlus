interface CustomEventTarget extends EventTarget {
  oninput: ((event: InputEvent) => any) | null;
  readonly validity: ValidityState;
}
interface CustomEvent extends InputEvent {
  target: CustomEventTarget;
}

interface gNumberInput {
  init: () => void;
  inputExpr: (event: CustomEvent) => void;
  changeExpr: (event: CustomEvent) => void;
}

declare var gNumberInput: gNumberInput;
