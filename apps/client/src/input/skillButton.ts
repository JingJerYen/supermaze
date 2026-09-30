/**
 * Small on-screen button that casts the floor's one-shot skill (tower run).
 * Same size as the discard button, to its left; shown while a skill is held,
 * dimmed while it cannot be cast yet (a lantern in the light).
 */
export class SkillButton {
  private readonly el: HTMLButtonElement;
  private pending = false;
  private shown = "";

  constructor(parent: HTMLElement) {
    this.el = document.createElement("button");
    this.el.dataset["nosound"] = ""; // pressed all game long: no menu tick
    Object.assign(this.el.style, {
      position: "fixed",
      // Left of the discard button, at its height.
      right: "calc(max(24px, env(safe-area-inset-right)) + 104px)",
      bottom: "calc(max(24px, env(safe-area-inset-bottom)) + 96px)",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.7)",
      background: "rgba(110,70,200,0.85)",
      color: "#fff",
      font: "bold 11px/1.1 system-ui, sans-serif",
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

  /** Show `icon` and `label`, or hide with null; `ready` false dims it. */
  setSkill(skill: { icon: string; label: string; ready: boolean } | null): void {
    const key = skill ? `${skill.icon}|${skill.label}|${skill.ready}` : "";
    if (key === this.shown) return;
    this.shown = key;
    if (!skill) {
      this.el.style.display = "none";
      return;
    }
    this.el.innerHTML = `<span style="font-size:20px;display:block">${skill.icon}</span>${skill.label}`;
    this.el.style.opacity = skill.ready ? "1" : "0.45";
    this.el.style.display = "block";
  }

  /** True once per press. */
  consume(): boolean {
    const p = this.pending;
    this.pending = false;
    return p;
  }
}
