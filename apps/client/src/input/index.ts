import type { PlayerInput } from "@supermaze/sim";
import { ActionButton } from "./actionButton.js";
import { KeyboardInput } from "./keyboard.js";
import { DpadInput } from "./dpad.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  private readonly dpad: DpadInput;
  readonly actionButton: ActionButton;

  constructor(surface: HTMLElement) {
    this.dpad = new DpadInput(surface);
    this.actionButton = new ActionButton(surface);
  }

  dispose(): void {
    this.dpad.dispose();
    this.actionButton.dispose();
  }

  read(): PlayerInput {
    // While the pad is held it drives movement; otherwise the keyboard does.
    const k = this.keyboard.read();
    const move = this.dpad.active ? this.dpad.read() : k;
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.action || this.actionButton.consume()) input.action = true;
    return input;
  }
}
