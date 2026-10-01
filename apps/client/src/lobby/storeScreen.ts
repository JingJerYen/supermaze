import type * as THREE from "three";
import { t } from "../i18n/index.js";
import { buyFullVersion, fullVersionPrice, isPremium, restorePurchases, syncPremium } from "../monetize/premium.js";
import { isNativeApp } from "../platform.js";
import type { Profile } from "../profile.js";
import { CharacterPreview } from "../render/characterPreview.js";
import { createSidePanel } from "../ui/sidePanel.js";

/**
 * The full version's page, opened from the home screen: what it gives, buy,
 * and restore an earlier purchase (the stores require the latter). In the app
 * this goes through Google Play (`monetize/premium.ts`); in a browser buying
 * is a placeholder that unlocks at once.
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
    // The app learns the store's price (and any refund) when the page opens.
    if (isNativeApp()) void syncPremium().then(() => this.panel.isConnected && this.render());
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
          : `<button class="primary" id="st-buy">${fullVersionPrice() ? t("lobby.store.buy", { price: fullVersionPrice() }) : t("lobby.store.buyNoPrice")}</button>`
      }</div>
      <div class="sp-note">${this.notice || t(isNativeApp() ? "lobby.store.payNoteApp" : "lobby.store.payNote")}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="st-home" data-back>${t("lobby.store.home")}</button><button id="st-restore">${t("lobby.store.restore")}</button></div>`;
    this.panel.querySelector("#st-buy")?.addEventListener("click", () => void this.buy());
    this.panel.querySelector("#st-restore")!.addEventListener("click", () => void this.restore());
    this.panel.querySelector("#st-home")!.addEventListener("click", () => this.onHome());
  }

  private async buy(): Promise<void> {
    const outcome = await buyFullVersion();
    this.notice = t(outcome === "owned" ? "lobby.store.bought" : outcome === "cancelled" ? "lobby.store.notBought" : "lobby.store.unavailable");
    this.render();
  }

  private async restore(): Promise<void> {
    const has = await restorePurchases();
    this.notice = t(has === null ? "lobby.store.unavailable" : has ? "lobby.store.restored" : "lobby.store.nothingToRestore");
    this.render();
  }
}
