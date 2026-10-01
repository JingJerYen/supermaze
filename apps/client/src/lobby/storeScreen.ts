import type * as THREE from "three";
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
      <h2>⭐ 完整版</h2>
      <div class="sp-sub">一次購買，永久擁有</div>
      <ul class="sp-perks">
        <li><b>🚫 免廣告</b><span>失敗直接繼續、技能直接自己挑，不用看廣告</span></li>
        <li><b>🎯 兩個技能</b><span>爬塔每一層可以帶兩個技能</span></li>
        <li><b>🏔️ 選擇起始樓層</b><span>從打過的任一層開始，選最高層就接著往上打</span></li>
      </ul>
      <div class="sp-row">${
        owned
          ? `<button class="owned" disabled>✓ 已擁有完整版</button>`
          : `<button class="primary" id="st-buy">購買　${FULL_VERSION_PRICE}</button>`
      }</div>
      <div class="sp-note">${this.notice || "付款由 Google Play / App Store 處理（測試版：按下購買直接解鎖）。"}</div>
      <div class="sp-spacer"></div>
      <div class="sp-row"><button id="st-home">回首頁</button><button id="st-restore">恢復購買</button></div>`;
    this.panel.querySelector("#st-buy")?.addEventListener("click", () => void this.buy());
    this.panel.querySelector("#st-restore")!.addEventListener("click", () => void this.restore());
    this.panel.querySelector("#st-home")!.addEventListener("click", () => this.onHome());
  }

  private async buy(): Promise<void> {
    this.notice = (await buyFullVersion()) ? "購買完成，謝謝支持！" : "購買沒有完成。";
    this.render();
  }

  private async restore(): Promise<void> {
    this.notice = (await restorePurchases()) ? "已恢復完整版。" : "這個帳號沒有購買紀錄。";
    this.render();
  }
}
