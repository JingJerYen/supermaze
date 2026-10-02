import { isNativeApp, RELEASE_BUILD } from "../platform.js";

/**
 * The full version (one-time purchase). Owning it means: no ads (a continue
 * and a picked skill come free), two skills a floor, and starting a tower run
 * on any floor already reached (CLAUDE.md section 4.2).
 *
 * In the release app the store decides (billing.ts, Google Play through RevenueCat):
 * the answer is kept here so `isPremium()` stays synchronous and the game
 * still knows offline, and `syncPremium()` refreshes it at startup. In a
 * browser and in the debug APK this is a placeholder: buying succeeds at
 * once, `?premium=1` or `?premium=0` sets it in a browser, and the debug APK's
 * store page can drop it again (`dropPremiumForTesting`).
 */
const KEY = "supermaze.premium";

/** Purchases go through the store: only in a release build of the app. */
export function storeBilling(): boolean {
  return isNativeApp() && RELEASE_BUILD;
}

let owned = read();
/** The store's price in the player's currency once known (app only). */
let price: string | null = null;

function read(): boolean {
  const param = typeof location !== "undefined" ? new URLSearchParams(location.search).get("premium") : null;
  if (!isNativeApp() && (param === "1" || param === "0")) {
    save(param === "1");
    return param === "1";
  }
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  owned = on;
  save(on);
}

/** Keep the flag in this browser (`write` also sets it for this page). */
function save(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the flag lasts for this page only */
  }
}

export function isPremium(): boolean {
  return owned;
}

/** Placeholder price for the browser build; the app shows the store's own. */
const PLACEHOLDER_PRICE = "NT$ 90";

/** The price to print on the buy button; the store's once fetched (`syncPremium`). */
export function fullVersionPrice(): string {
  return price ?? (storeBilling() ? "" : PLACEHOLDER_PRICE);
}

/**
 * App only: ask the store whether this account owns the full version (a
 * refund takes it away) and fetch the price. Offline, the last answer stands.
 */
export async function syncPremium(): Promise<void> {
  if (!storeBilling()) return;
  const billing = await import("./billing.js");
  const [has, cost] = await Promise.all([billing.storeOwnsFullVersion(), billing.storePrice()]);
  if (has !== null) write(has);
  if (cost) price = cost;
}

/** Buy the full version. Resolves "owned", "cancelled", or "failed" (store unreachable or refused). */
export async function buyFullVersion(): Promise<"owned" | "cancelled" | "failed"> {
  if (!storeBilling()) {
    write(true);
    return "owned";
  }
  const outcome = await (await import("./billing.js")).storeBuy();
  if (outcome === "owned") write(true);
  return outcome;
}

/** Ask the store for earlier purchases (required on iOS). Resolves whether it is owned, or null when the store cannot be reached. */
export async function restorePurchases(): Promise<boolean | null> {
  if (!storeBilling()) return owned;
  const has = await (await import("./billing.js")).storeRestore();
  if (has !== null) write(has);
  return has;
}

/** Placeholder builds only (the debug APK has no `?premium=0`): back to the free version. */
export function dropPremiumForTesting(): void {
  if (!storeBilling()) write(false);
}
