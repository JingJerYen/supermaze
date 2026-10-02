import type { PlayerInput } from "@supermaze/sim";
import { loadControls } from "../settings.js";
import { ActionButton } from "./actionButton.js";
import { DiscardButton } from "./discardButton.js";
import { KeyboardInput } from "./keyboard.js";
import { SkillButton } from "./skillButton.js";
import { DpadInput } from "./dpad.js";
import { StickInput, type StickPlayer } from "./stick.js";
import { guardPageGestures } from "./touchGuard.js";

/** Merges every input device into one intent. Gameplay code only ever sees the intent. */
export class InputSource {
  private readonly keyboard = new KeyboardInput();
  /** The corner pad or the corner joystick, whichever the settings page picked. */
  private readonly touch: DpadInput | StickInput;
  private readonly unguard: () => void;
  readonly actionButton: ActionButton;
  readonly discardButton: DiscardButton;
  readonly skillButton: SkillButton;
  readonly skillButton2: SkillButton;

  constructor(surface: HTMLElement) {
    this.unguard = guardPageGestures();
    this.touch = loadControls() === "stick" ? new StickInput(surface) : new DpadInput(surface);
    this.actionButton = new ActionButton(surface);
    this.discardButton = new DiscardButton(surface);
    this.skillButton = new SkillButton(surface);
    this.skillButton2 = new SkillButton(surface, 2);
  }

  dispose(): void {
    this.unguard();
    this.touch.dispose();
    this.actionButton.dispose();
    this.discardButton.dispose();
    this.skillButton.dispose();
    this.skillButton2.dispose();
  }

  /** The local player as last drawn; the stick needs it to turn without stepping. */
  setPlayer(p: StickPlayer | null): void {
    if (this.touch instanceof StickInput) this.touch.setPlayer(p);
  }

  read(): PlayerInput {
    // While the pad or stick is held it drives movement; otherwise the keyboard does.
    const k = this.keyboard.read();
    const touch = this.touch.read();
    const move = this.touch.active ? touch : k;
    const input: PlayerInput = { moveX: move.moveX, moveY: move.moveY };
    if (k.action || this.actionButton.consume()) input.action = true;
    if (k.discard || this.discardButton.consume()) input.discard = true;
    if (k.skill || this.skillButton.consume()) input.skill = true;
    if (k.skill2 || this.skillButton2.consume()) input.skill2 = true;
    return input;
  }
}
