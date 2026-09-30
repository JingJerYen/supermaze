/**
 * Touch target of the big round button at the bottom right. It draws nothing:
 * the HUD paints the button (the next item, or 登塔 / 開關 / 收回傳送點) and
 * this transparent circle on top of it takes the press. Pressing when nothing
 * can be done is harmless; the simulation decides.
 */
export class ActionButton {
  private readonly el: HTMLButtonElement;
  private pending = false;

  constructor(parent: HTMLElement, rightPx = 24) {
    this.el = document.createElement("button");
    this.el.dataset["nosound"] = ""; // pressed all game long: no menu tick
    Object.assign(this.el.style, {
      position: "fixed",
      right: `max(${rightPx}px, env(safe-area-inset-right))`,
      bottom: "max(24px, env(safe-area-inset-bottom))",
      width: "84px",
      height: "84px",
      borderRadius: "50%",
      border: "none",
      background: "transparent",
      padding: "0",
      display: "none",
      zIndex: "6",
      touchAction: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    this.el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.pending = true;
    });
    parent.appendChild(this.el);
  }

  dispose(): void {
    this.el.remove();
  }

  /** Take presses while the player is in the maze; off on the tower and before play. */
  setActive(on: boolean): void {
    const display = on ? "block" : "none";
    if (this.el.style.display !== display) this.el.style.display = display;
  }

  /** True once per press. */
  consume(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}
