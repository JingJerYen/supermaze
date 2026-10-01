import { t } from "../i18n/index.js";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Rewarded ads: the player chooses to watch one for a reward (a continue, a
 * picked skill). Placeholder until the app ships: a full-screen card counts
 * down `monetize.placeholderAdSec` and can be closed early, which forfeits the
 * reward. In the app this is where the ad network's rewarded ad goes (AdMob
 * through a Capacitor plugin); its length is the advertiser's, not ours.
 * Resolves true when the reward is earned.
 */
export function showRewardedAd(reward: string): Promise<boolean> {
  installCss();
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "ad";
    root.innerHTML = `
      <div class="ad-card">
        <div class="ad-tag">${t("modes.ad.tag")}</div>
        <div class="ad-body">${t("modes.ad.body")}<br><small>${t("modes.ad.placeholder")}</small></div>
        <div class="ad-reward">${t("modes.ad.reward", { reward })}</div>
        <div class="ad-foot"><span class="ad-count"></span><button class="ad-close" data-nosound>${t("modes.ad.close")}</button></div>
      </div>`;
    document.body.appendChild(root);
    const count = root.querySelector<HTMLElement>(".ad-count")!;
    const close = root.querySelector<HTMLButtonElement>(".ad-close")!;
    let left = CLIENT_TUNING.monetize.placeholderAdSec;
    const finish = (earned: boolean) => {
      clearInterval(timer);
      root.remove();
      resolve(earned);
    };
    const tick = () => {
      count.textContent = left > 0 ? t("modes.ad.countdown", { n: left }) : t("modes.ad.earned");
      close.textContent = left > 0 ? t("modes.ad.skip") : t("modes.ad.claim");
      close.classList.toggle("done", left <= 0);
    };
    const timer = window.setInterval(() => {
      left -= 1;
      tick();
    }, 1000);
    close.addEventListener("click", () => finish(left <= 0));
    tick();
  });
}

const CSS = `
.ad{position:fixed;inset:0;z-index:60;background:rgba(4,6,10,.92);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff}
.ad-card{width:min(420px,90vw);border-radius:16px;background:#1b2130;border:1px solid rgba(255,255,255,.16);padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.ad-tag{align-self:flex-start;font-size:12px;background:#ffd23f;color:#412402;border-radius:6px;padding:2px 8px;font-weight:600}
.ad-body{text-align:center;font-size:18px;padding:24px 0;border-radius:12px;background:repeating-linear-gradient(45deg,#232a3b 0 12px,#20273a 12px 24px)}
.ad-body small{font-size:12px;color:#9aa6bf}
.ad-reward{font-size:14px;color:#c9d2e3}
.ad-foot{display:flex;justify-content:space-between;align-items:center;gap:10px}
.ad-count{font-size:13px;color:#c9d2e3}
.ad-close{height:38px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;padding:0 14px;font-size:14px;cursor:pointer}
.ad-close.done{background:#ffd23f;color:#412402;border-color:#ffd23f;font-weight:600}
`;

function installCss(): void {
  if (document.getElementById("ad-css")) return;
  const style = document.createElement("style");
  style.id = "ad-css";
  style.textContent = CSS;
  document.head.appendChild(style);
}
