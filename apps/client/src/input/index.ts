import type { PlayerInput } from "@supermaze/sim";
import { ClimbButton } from "./climbButton.js";
import { KeyboardInput } from "./keyboard.js";
import { TouchInput } from "./touch.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  private readonly touch: TouchInput;
  readonly climbButton: ClimbButton;

  constructor(surface: HTMLElement) {
    this.touch = new TouchInput(surface);
    this.climbButton = new ClimbButton(surface);
  }

  read(): PlayerInput {
    const k = this.keyboard.read();
    const move = k.moveX !== 0 || k.moveY !== 0 ? k : this.touch.read();
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.climb || this.climbButton.consume()) input.climb = true;
    return input;
  }
}
