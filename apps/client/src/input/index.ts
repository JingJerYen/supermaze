import type { PlayerInput } from "@supermaze/sim";
import { ActionButton } from "./actionButton.js";
import { DiscardButton } from "./discardButton.js";
import { KeyboardInput } from "./keyboard.js";
import { SkillButton } from "./skillButton.js";
import { DpadInput } from "./dpad.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  private readonly dpad: DpadInput;
  readonly actionButton: ActionButton;
  readonly discardButton: DiscardButton;
  readonly skillButton: SkillButton;

  constructor(surface: HTMLElement) {
    this.dpad = new DpadInput(surface);
    this.actionButton = new ActionButton(surface);
    this.discardButton = new DiscardButton(surface);
    this.skillButton = new SkillButton(surface);
  }

  dispose(): void {
    this.dpad.dispose();
    this.actionButton.dispose();
    this.discardButton.dispose();
    this.skillButton.dispose();
  }

  read(): PlayerInput {
    // While the pad is held it drives movement; otherwise the keyboard does.
    const k = this.keyboard.read();
    const move = this.dpad.active ? this.dpad.read() : k;
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.action || this.actionButton.consume()) input.action = true;
    if (k.discard || this.discardButton.consume()) input.discard = true;
    if (k.skill || this.skillButton.consume()) input.skill = true;
    return input;
  }
}
