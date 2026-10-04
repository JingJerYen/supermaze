/**
 * Store settings for the app build (CLAUDE.md section 4.2). The game has no
 * ads; the one thing sold is the full version. The key comes from a
 * build-time variable so no account details live in the repo; set it in the
 * shell or in apps/client/.env.production.local (not in git) before
 * `npm run build:release`:
 *
 *   VITE_REVENUECAT_KEY      RevenueCat public SDK key for Android (goog_…)
 */
const env = import.meta.env as Record<string, string | undefined>;

/** RevenueCat public key; without it the app cannot sell the full version. */
export const REVENUECAT_KEY: string | null = env["VITE_REVENUECAT_KEY"] || null;

/** The one-time product in Play Console and the RevenueCat entitlement it grants. */
export const FULL_VERSION_PRODUCT = "full_version";
export const FULL_VERSION_ENTITLEMENT = "full_version";
