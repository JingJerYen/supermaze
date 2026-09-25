/**
 * On-screen "climb" button for touch play. Shown only while the local player is
 * allowed to climb, so it doubles as the visual cue that the key can be used.
 */
export class ClimbButton {
  private readonly el: HTMLButtonElement;
  private pending = false;

  constructor(parent: HTMLElement, label = "登塔") {
    this.el = document.createElement("button");
    this.el.textContent = label;
    Object.assign(this.el.style, {
      position: "fixed",
      right: "max(24px, env(safe-area-inset-right))",
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

  setVisible(v: boolean): void {
    this.el.style.display = v ? "block" : "none";
  }

  /** True once per press. */
  consume(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}
