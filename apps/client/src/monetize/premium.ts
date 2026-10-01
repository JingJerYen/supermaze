/**
 * The full version (one-time purchase). Owning it means: no ads (a continue
 * and a picked skill come free), two skills a floor, and starting a tower run
 * on any floor already reached. Kept in this browser for now; once the app
 * ships, `buyFullVersion` and `restorePurchases` go through the store
 * (Google Play / App Store in-app purchase) and this flag mirrors what the
 * store says. `?premium=1` or `?premium=0` sets it for testing.
 */
const KEY = "supermaze.premium";

let owned = read();

function read(): boolean {
  const param = new URLSearchParams(location.search).get("premium");
  if (param === "1" || param === "0") {
    write(param === "1");
    return param === "1";
  }
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean): void {
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

/** Placeholder price shown on the store page; the real one comes from the store. */
export const FULL_VERSION_PRICE = "NT$ 90";

/** Buy the full version. Placeholder: succeeds at once. Resolves whether it is owned afterwards. */
export async function buyFullVersion(): Promise<boolean> {
  owned = true;
  write(true);
  return true;
}

/** Ask the store for earlier purchases (required on iOS). Placeholder: reports what this browser knows. */
export async function restorePurchases(): Promise<boolean> {
  return owned;
}
