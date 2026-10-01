/**
 * Store and ad network settings for the app build (CLAUDE.md section 4.2).
 * Values come from build-time variables so no account details live in the
 * repo; set them in the shell or in apps/client/.env.production.local (not in
 * git) before `npm run build:release`:
 *
 *   VITE_ADMOB_REWARDED_ID   AdMob rewarded ad unit, ca-app-pub-…/…
 *   VITE_REVENUECAT_KEY      RevenueCat public SDK key for Android (goog_…)
 *
 * The AdMob *app* id is not here: it goes in the Android manifest
 * (docs/android-apk-handoff.md), and the app crashes at launch without it.
 */
const env = import.meta.env as Record<string, string | undefined>;

/** A store release build (`npm run build:release`): no test ads, no developer aids. */
export const RELEASE = env["VITE_RELEASE"] === "1";

/** Google's published test rewarded unit for Android; safe to show any number of times. */
const TEST_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917";

/** The rewarded ad unit: the real one, or Google's test unit outside a release; null means no ads. */
export const REWARDED_AD_ID: string | null = env["VITE_ADMOB_REWARDED_ID"] || (RELEASE ? null : TEST_REWARDED_ID);

/** Request test ads (never real ones) unless this is a release build with a real ad unit. */
export const TEST_ADS = !RELEASE || !env["VITE_ADMOB_REWARDED_ID"];

/** RevenueCat public key; without it the app cannot sell the full version. */
export const REVENUECAT_KEY: string | null = env["VITE_REVENUECAT_KEY"] || null;

/** The one-time product in Play Console and the RevenueCat entitlement it grants. */
export const FULL_VERSION_PRODUCT = "full_version";
export const FULL_VERSION_ENTITLEMENT = "full_version";
