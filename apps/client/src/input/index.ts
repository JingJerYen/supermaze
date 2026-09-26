import type { PlayerInput } from "@supermaze/sim";
import { ActionButton } from "./actionButton.js";
import { KeyboardInput } from "./keyboard.js";
import { TouchInput } from "./touch.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  private readonly touch: TouchInput;
  readonly actionButton: ActionButton;

  constructor(surface: HTMLElement) {
    this.touch = new TouchInput(surface);
    this.actionButton = new ActionButton(surface);
  }

  dispose(): void {
    this.touch.dispose();
    this.actionButton.dispose();
  }

  read(): PlayerInput {
    // While the stick is held it drives movement; otherwise the keyboard does.
    const k = this.keyboard.read();
    const move = this.touch.active ? this.touch.read() : k;
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.action || this.actionButton.consume()) input.action = true;
    return input;
  }
}
