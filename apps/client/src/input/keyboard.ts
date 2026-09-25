import type { MoveIntent } from "@supermaze/sim";

/** WASD / arrow keys -> movement intent. Held keys are re-read every tick. */
export class KeyboardInput {
  private readonly down = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      this.down.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  read(): MoveIntent {
    const has = (...codes: string[]) => codes.some((c) => this.down.has(c));
    const moveX = (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0);
    const moveY = (has("KeyS", "ArrowDown") ? 1 : 0) - (has("KeyW", "ArrowUp") ? 1 : 0);
    return { moveX, moveY };
  }
}
