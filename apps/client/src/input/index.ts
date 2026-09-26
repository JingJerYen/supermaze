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
    const k = this.keyboard.read();
    const move = k.moveX !== 0 || k.moveY !== 0 ? k : this.touch.read();
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.action || this.actionButton.consume()) input.action = true;
    return input;
  }
}
