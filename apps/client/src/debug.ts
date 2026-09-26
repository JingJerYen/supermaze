/**
 * Always-on debug overlay. Exists before any gameplay so problems can be described
 * precisely ("fps drops to 30 when 4 players are visible") instead of "feels off".
 */
export interface DebugStats {
  fps: number;
  tick: number;
  objects: number;
  extra?: Record<string, string | number>;
}

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly bannerEl: HTMLDivElement;
  private frames = 0;
  private lastFpsSample = performance.now();
  private fps = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      top: "8px",
      left: "8px",
      padding: "6px 8px",
      font: "12px/1.4 monospace",
      color: "#cfe3ff",
      background: "rgba(0,0,0,0.55)",
      pointerEvents: "none",
      whiteSpace: "pre",
      zIndex: "10",
      display: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.el);
    // Developer panel: hidden by default, F3 toggles it.
    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.el.style.display = this.el.style.display === "none" ? "block" : "none";
      }
    });

    this.bannerEl = document.createElement("div");
    Object.assign(this.bannerEl.style, {
      position: "fixed",
      left: "50%",
      top: "40%",
      transform: "translate(-50%, -50%)",
      maxWidth: "80vw",
      padding: "14px 18px",
      font: "15px/1.5 system-ui, sans-serif",
      color: "#fff",
      background: "rgba(20,24,32,0.85)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "8px",
      whiteSpace: "pre-wrap",
      textAlign: "center",
      pointerEvents: "none",
      display: "none",
      zIndex: "20",
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.bannerEl);
  }

  dispose(): void {
    this.el.remove();
    this.bannerEl.remove();
  }

  /** Show a centre-screen message, or hide it with null. */
  banner(text: string | null): void {
    if (text === null) {
      this.bannerEl.style.display = "none";
      return;
    }
    if (this.bannerEl.textContent !== text) this.bannerEl.textContent = text;
    this.bannerEl.style.display = "block";
  }

  /** Call once per rendered frame. */
  frame(stats: Omit<DebugStats, "fps">): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsSample >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsSample));
      this.frames = 0;
      this.lastFpsSample = now;
    }
    const lines = [`fps ${this.fps}`, `tick ${stats.tick}`, `objects ${stats.objects}`];
    for (const [k, v] of Object.entries(stats.extra ?? {})) lines.push(`${k} ${v}`);
    this.el.textContent = lines.join("\n");
  }
}
