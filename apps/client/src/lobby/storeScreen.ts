import type * as THREE from "three";
import { t } from "../i18n/index.js";
import { buyFullVersion, FULL_VERSION_PRICE, isPremium, restorePurchases } from "../monetize/premium.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel } from "../ui/sidePanel.js";

/**
 * The full version's page, opened from the home screen: what it gives, buy,
 * and restore an earlier purchase (the stores require the latter). Buying is
 * a placeholder until the app's in-app purchase is wired (`monetize/premium.ts`).
 */
export class StoreScreen {
  private readonly panel: HTMLDivElement;
  private readonly preview: CharacterPreview;
  private notice = "";

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
    const owned = isPremium();
    this.panel.innerHTML = `
      <h2>⭐ ${t("lobby.home.fullVersion")}</h2>
      <div class="sp-sub">${t("lobby.store.sub")}</div>
      <ul class="sp-perks">
        <li><b>🚫 ${t("lobby.store.noAds")}</b><span>${t("lobby.store.noAdsDesc")}</span></li>
        <li><b>🎯 ${t("lobby.store.twoSkills")}</b><span>${t("lobby.store.twoSkillsDesc")}</span></li>
        <li><b>🏔️ ${t("lobby.store.startFloor")}</b><span>${t("lobby.store.startFloorDesc")}</span></li>
      </ul>
      <div class="sp-row">${
        owned
          ? `<button class="owned" disabled>✓ ${t("lobby.home.fullVersionOwned")}</button>`
          : `<button class="primary" id="st-buy">${t("lobby.store.buy", { price: FULL_VERSION_PRICE })}</button>`
      }</div>
      <div class="sp-note">${this.notice || t("lobby.store.payNote")}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="st-home">${t("lobby.store.home")}</button><button id="st-restore">${t("lobby.store.restore")}</button></div>`;
    this.panel.querySelector("#st-buy")?.addEventListener("click", () => void this.buy());
    this.panel.querySelector("#st-restore")!.addEventListener("click", () => void this.restore());
    this.panel.querySelector("#st-home")!.addEventListener("click", () => this.onHome());
  }

  private async buy(): Promise<void> {
    this.notice = (await buyFullVersion()) ? t("lobby.store.bought") : t("lobby.store.notBought");
    this.render();
  }

  private async restore(): Promise<void> {
    this.notice = (await restorePurchases()) ? t("lobby.store.restored") : t("lobby.store.nothingToRestore");
    this.render();
  }
}
