import type * as THREE from "three";
import { DEFAULT_TUNING } from "@supermaze/sim";
import { t } from "../i18n/index.js";
import { Match } from "../match.js";
import { createDemoMode } from "./demoMode.js";
import { RULE_SCENES, ruleText } from "./scenes.js";

const CSS = `
.rs-rules{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));bottom:max(12px,env(safe-area-inset-bottom));
  width:min(340px,40vw);display:flex;flex-direction:column;gap:10px;padding:16px 18px;border-radius:16px;z-index:25;
  background:rgba(16,19,24,var(--rules-alpha,.45));border:1px solid rgba(255,255,255,.14);color:#fff;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;
  text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 8px rgba(0,0,0,.7)}
/* Short screens (phones held sideways): a narrower, lighter panel so the scene shows through. */
@media (max-height:520px){.rs-rules{width:min(280px,34vw);padding:10px 12px;gap:6px;--rules-alpha:.3}
  .rs-rules button{height:34px;font-size:14px}}
.rs-rules button{text-shadow:none}
.rs-rules *{box-sizing:border-box}
.rs-rules h2{font-size:clamp(17px,2.6vh,21px);font-weight:500;margin:0;color:#ffd23f}
.rs-rules-page{font-size:12px;color:#c9d2e3}
.rs-rules-text{flex:1;overflow:auto;display:flex;flex-direction:column;gap:10px;font-size:clamp(13px,2.2vh,15px);line-height:1.55;color:#e8ecf4}
.rs-rules-text p{margin:0}
.rs-rules-table{width:100%;border-collapse:collapse;font-size:13px}
.rs-rules-table td{padding:5px 0;border-top:1px solid rgba(255,255,255,.12)}
.rs-rules-table td:last-child{text-align:right;color:#ffd23f;white-space:nowrap;padding-left:8px}
.rs-rules-nav{display:flex;gap:8px}
.rs-rules button{flex:1;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:15px;cursor:pointer}
.rs-rules button.primary{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:500}
.rs-rules button:disabled{opacity:.35;cursor:default}
`;

/**
 * The rules: one card at a time, text in a panel on the left and the matching
 * scene playing on the game canvas behind it. Only the card on screen runs, on
 * the one shared renderer, so phones never hold more than one WebGL scene.
 */
export class RulesScreen {
  private readonly panel: HTMLDivElement;
  private match: Match | null = null;
  private index = 0;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.code === "ArrowRight") this.show(this.index + 1);
    else if (e.code === "ArrowLeft") this.show(this.index - 1);
    else if (e.code === "Escape") this.onClose();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly onClose: () => void,
  ) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    // "rs" marks it as a panel for the input layer, so touches on it are not play-area touches.
    this.panel = document.createElement("div");
    this.panel.className = "rs rs-rules";
    root.appendChild(this.panel);
    window.addEventListener("keydown", this.onKey);
    this.show(0);
  }

  private show(index: number): void {
    if (index < 0 || index >= RULE_SCENES.length) return;
    this.index = index;
    const scene = RULE_SCENES[index]!;
    this.match?.dispose();
    this.match = new Match(this.root, this.renderer, createDemoMode(scene), { demo: true });

    this.panel.innerHTML = `
      <div class="rs-rules-page"></div>
      <h2></h2>
      <div class="rs-rules-text"></div>
      <div class="rs-rules-nav"><button id="rs-prev"></button><button id="rs-next" class="primary"></button></div>
      <div class="rs-rules-nav"><button id="rs-close" data-back></button></div>`;
    this.panel.querySelector(".rs-rules-page")!.textContent = t("rules.screen.page", { page: index + 1, total: RULE_SCENES.length });
    this.panel.querySelector("h2")!.textContent = scene.title;
    const text = this.panel.querySelector(".rs-rules-text")!;
    for (const line of ruleText(scene, DEFAULT_TUNING)) {
      const p = document.createElement("p");
      p.textContent = line;
      text.appendChild(p);
    }
    if (scene.table) {
      const table = document.createElement("table");
      table.className = "rs-rules-table";
      for (const [label, value] of scene.table(DEFAULT_TUNING)) {
        const row = table.insertRow();
        row.insertCell().textContent = label;
        row.insertCell().textContent = value;
      }
      text.appendChild(table);
    }
    const prev = this.panel.querySelector<HTMLButtonElement>("#rs-prev")!;
    const next = this.panel.querySelector<HTMLButtonElement>("#rs-next")!;
    const close = this.panel.querySelector<HTMLButtonElement>("#rs-close")!;
    prev.textContent = t("rules.screen.prev");
    next.textContent = t("rules.screen.next");
    close.textContent = t("rules.screen.home");
    prev.disabled = index === 0;
    next.disabled = index === RULE_SCENES.length - 1;
    prev.addEventListener("click", () => this.show(this.index - 1));
    next.addEventListener("click", () => this.show(this.index + 1));
    close.addEventListener("click", () => this.onClose());
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    this.match?.dispose();
    this.match = null;
    this.panel.remove();
  }
}
