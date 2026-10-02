import { Capacitor } from "@capacitor/core";

/**
 * Where the client runs (CLAUDE.md section 17.1, Android handoff T3). Every
 * check for "in the app or in a browser" goes through here, so the web build
 * behaves exactly as before.
 */

/** Inside the Android or iOS app (Capacitor), not a browser tab. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Which store's app this is, or "web". */
export function platformName(): "android" | "ios" | "web" {
  const p = Capacitor.getPlatform();
  return p === "android" || p === "ios" ? p : "web";
}

/** A store release build (`npm run build:release`); the debug APK and the web build are not. */
export const RELEASE_BUILD: boolean = import.meta.env["VITE_RELEASE"] === "1";

/**
 * Developer aids (F3 panel, F4 forced ghost event). On everywhere except a
 * store release build (`npm run build:release` sets VITE_RELEASE=1); `?debug`
 * turns them back on there for a quick check.
 */
export const DEV_TOOLS: boolean =
  !RELEASE_BUILD || (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug"));
