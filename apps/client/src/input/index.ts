import type { MoveIntent } from "@supermaze/sim";
import { KeyboardInput } from "./keyboard.js";
import { TouchInput } from "./touch.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  private readonly touch: TouchInput;

  constructor(surface: HTMLElement) {
    this.touch = new TouchInput(surface);
  }

  read(): MoveIntent {
    const k = this.keyboard.read();
    if (k.moveX !== 0 || k.moveY !== 0) return k;
    return this.touch.read();
  }
}
