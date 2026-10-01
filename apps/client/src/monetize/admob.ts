import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from "@capacitor-community/admob";
import { REWARDED_AD_ID, TEST_ADS } from "./config.js";

/**
 * Rewarded ads in the app through AdMob (CLAUDE.md section 4.2). Loaded only
 * inside the app; the web build keeps the placeholder card in ads.ts.
 *
 * Before the first ad, Google's consent message (UMP) is shown where the law
 * asks for it (EU, UK); AdMob requires this. `canRequestAds` false means the
 * player declined or the message could not be shown, so no ad is requested.
 */
let started: Promise<boolean> | null = null;

function start(): Promise<boolean> {
  started ??= (async () => {
    await AdMob.initialize({ initializeForTesting: TEST_ADS });
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
    return info.canRequestAds;
  })().catch((e: unknown) => {
    console.warn("ads: start failed", e);
    started = null; // try again next time
    return false;
  });
  return started;
}

/** Warm up early (consent message, SDK start) so the first ad opens quickly. */
export function prepareAds(): void {
  if (REWARDED_AD_ID) void start();
}

/** "earned", "skipped" (closed before the reward), or "unavailable" (no ad could be loaded or shown). */
export type AdOutcome = "earned" | "skipped" | "unavailable";

export async function showAdMobRewarded(): Promise<AdOutcome> {
  if (!REWARDED_AD_ID || !(await start())) return "unavailable";
  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID, isTesting: TEST_ADS });
  } catch (e) {
    console.warn("ads: no rewarded ad", e);
    return "unavailable";
  }
  return new Promise((resolve) => {
    let earned = false;
    const handles = [
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (earned = true)),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(earned ? "earned" : "skipped")),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish("unavailable")),
    ];
    function finish(outcome: AdOutcome): void {
      for (const h of handles) void h.then((l) => l.remove());
      resolve(outcome);
    }
    AdMob.showRewardVideoAd().catch(() => finish("unavailable"));
  });
}
