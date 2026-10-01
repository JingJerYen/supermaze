import { isNativeApp } from "../platform.js";

/**
 * The Android back button (Android handoff T5). Every screen marks the control
 * that means "back" with a `data-back` attribute: the home button of the
 * online page, store and tower-run screens, the rules screen's close, the ✕
 * in a match (which keeps its press-twice confirm), the ad's close. Back
 * presses the topmost visible one; with none on screen (the home page) it
 * leaves the app. Navigation only, so no screen needs wiring of its own.
 */
export function installBackButton(): void {
  if (!isNativeApp()) return;
  void import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", () => {
      const target = backTarget();
      if (target) target.click();
      else void App.exitApp();
    }),
  );
}

/** The last visible `[data-back]` in document order: overlays come after what they cover. */
export function backTarget(doc: Document = document): HTMLElement | null {
  const all = Array.from(doc.querySelectorAll<HTMLElement>("[data-back]"));
  for (let i = all.length - 1; i >= 0; i--) {
    const el = all[i]!;
    if (isShown(el)) return el;
  }
  return null;
}

function isShown(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}
