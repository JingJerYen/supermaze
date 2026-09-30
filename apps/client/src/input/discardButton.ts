/**
 * On-screen button that throws away the oldest carried item. Small and above
 * the action button so a thumb reaching for "use" does not hit it by accident;
 * shown only while there is something to discard.
 */
export class DiscardButton {
  private readonly el: HTMLButtonElement;
  private pending = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("button");
    this.el.dataset["nosound"] = ""; // pressed all game long: no menu tick
    this.el.textContent = "丟棄";
    Object.assign(this.el.style, {
      position: "fixed",
      // Centred over the 84px action button, 12px above it.
      right: "calc(max(24px, env(safe-area-inset-right)) + 14px)",
      bottom: "calc(max(24px, env(safe-area-inset-bottom)) + 96px)",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.6)",
      background: "rgba(190,60,60,0.8)",
      color: "#fff",
      font: "bold 14px system-ui, sans-serif",
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

  setVisible(on: boolean): void {
    this.el.style.display = on ? "block" : "none";
  }

  /** True once per press. */
  consume(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}
