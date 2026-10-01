import { Purchases, PRODUCT_CATEGORY, PURCHASES_ERROR_CODE, type PurchasesStoreProduct } from "@revenuecat/purchases-capacitor";
import { FULL_VERSION_ENTITLEMENT, FULL_VERSION_PRODUCT, REVENUECAT_KEY } from "./config.js";

/**
 * The full version through Google Play billing, by way of RevenueCat
 * (CLAUDE.md section 4.2). Loaded only inside the app; the web build keeps the
 * placeholder in premium.ts. The store keeps the purchase on the player's
 * Google account; this only asks.
 */
let ready: Promise<boolean> | null = null;
let product: PurchasesStoreProduct | null = null;

function start(): Promise<boolean> {
  ready ??= (async () => {
    if (!REVENUECAT_KEY) return false;
    await Purchases.configure({ apiKey: REVENUECAT_KEY });
    return true;
  })().catch((e: unknown) => {
    console.warn("billing: start failed", e);
    ready = null;
    return false;
  });
  return ready;
}

function owns(info: { entitlements: { active: Record<string, unknown> } }): boolean {
  return FULL_VERSION_ENTITLEMENT in info.entitlements.active;
}

/** Whether the store says this account owns the full version; null when it cannot be asked (offline, no key). */
export async function storeOwnsFullVersion(): Promise<boolean | null> {
  if (!(await start())) return null;
  try {
    return owns((await Purchases.getCustomerInfo()).customerInfo);
  } catch (e) {
    console.warn("billing: no customer info", e);
    return null;
  }
}

/** The full version's price in the player's currency, as the store writes it; null until known. */
export async function storePrice(): Promise<string | null> {
  if (!(await start())) return null;
  try {
    product ??= (await Purchases.getProducts({ productIdentifiers: [FULL_VERSION_PRODUCT], type: PRODUCT_CATEGORY.NON_SUBSCRIPTION })).products[0] ?? null;
    return product?.priceString ?? null;
  } catch (e) {
    console.warn("billing: no product", e);
    return null;
  }
}

/** "owned" after a purchase, "cancelled" by the player, or "failed". */
export async function storeBuy(): Promise<"owned" | "cancelled" | "failed"> {
  if (!(await storePrice()) || !product) return "failed";
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
    return owns(customerInfo) ? "owned" : "failed";
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean | null };
    if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "cancelled";
    console.warn("billing: purchase failed", e);
    return "failed";
  }
}

/** Ask the store again for earlier purchases on this account; null when it cannot be asked. */
export async function storeRestore(): Promise<boolean | null> {
  if (!(await start())) return null;
  try {
    return owns((await Purchases.restorePurchases()).customerInfo);
  } catch (e) {
    console.warn("billing: restore failed", e);
    return null;
  }
}
