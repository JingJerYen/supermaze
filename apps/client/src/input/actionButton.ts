/**
 * On-screen context-action button for touch play. Shown only while the local
 * player can do something, with a label saying what (climb / switch).
 */
export class ActionButton {
  private readonly el: HTMLButtonElement;
  private pending = false;

  constructor(parent: HTMLElement, rightPx = 24) {
    this.el = document.createElement("button");
    Object.assign(this.el.style, {
      position: "fixed",
      right: `max(${rightPx}px, env(safe-area-inset-right))`,
      bottom: "max(24px, env(safe-area-inset-bottom))",
      width: "84px",
      height: "84px",
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.7)",
      background: "rgba(255,210,63,0.85)",
      color: "#222",
      font: "bold 18px system-ui, sans-serif",
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

  /** Show with a label, or hide with null. */
  setAction(label: string | null): void {
    if (label === null) {
      this.el.style.display = "none";
      return;
    }
    if (this.el.textContent !== label) this.el.textContent = label;
    this.el.style.display = "block";
  }

  /** True once per press. */
  consume(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}
