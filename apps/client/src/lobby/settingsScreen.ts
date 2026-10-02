import type * as THREE from "three";
import { t } from "../i18n/index.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { CONTROL_SCHEMES, loadControls, saveControls, type ControlScheme } from "../settings.js";
import { createSidePanel } from "../ui/sidePanel.js";

/** Pictures of the two touch controls, drawn in code like the home icons. */
const PICTURES: Record<ControlScheme, string> = {
  dpad: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 4h12v14h14v12H30v14H18V30H4V18h14z" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.75)" stroke-width="2" stroke-linejoin="round"/><path d="M24 8l-4 5h8zM24 40l-4-5h8zM8 24l5-4v8zM40 24l-5-4v8z" fill="#fff"/></svg>`,
  stick: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.75)" stroke-width="2.5"/><circle cx="24" cy="24" r="10" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="31" cy="20" r="7" fill="rgba(255,255,255,.85)"/></svg>`,
};

/**
 * Per-device settings, opened from the home screen: for now the touch
 * controls, the corner pad or the floating stick (`input/`). Saved at once;
 * the next match builds its input with it.
 */
export class SettingsScreen {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;

  constructor(
    root: HTMLElement,
    renderer: THREE.WebGLRenderer,
    profile: Profile,
    private readonly onHome: () => void,
  ) {
    this.preview = new CharacterPreview(renderer);
    this.preview.show(profile.character ?? "local");
    this.preview.start();
    this.panel = createSidePanel(root);
    this.render();
  }

  dispose(): void {
    this.preview.stop();
    this.panel.remove();
  }

  private render(): void {
    const current = loadControls();
    const option = (c: ControlScheme) =>
      `<button data-scheme="${c}" class="${c === current ? "on" : ""}">${PICTURES[c]}<span><b>${t(`lobby.settings.${c}`)}</b><small>${t(`lobby.settings.${c}Desc`)}</small></span></button>`;
    this.panel.innerHTML = `
      <h2>⚙️ ${t("lobby.home.settings")}</h2>
      <label>${t("lobby.settings.controls")}</label>
      <div class="sp-opts">${CONTROL_SCHEMES.map(option).join("")}</div>
      <div class="sp-note">${t("lobby.settings.note")}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="se-home" data-back>${t("lobby.settings.home")}</button></div>`;
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>("[data-scheme]")) {
      b.addEventListener("click", () => {
        saveControls(b.dataset["scheme"] as ControlScheme);
        this.render();
      });
    }
    this.panel.querySelector("#se-home")!.addEventListener("click", () => this.onHome());
  }
}
