/**
 * Mobile browsers keep their address bar over the game. The first touch on the
 * page asks for fullscreen and, once in fullscreen, tries to lock the
 * orientation to landscape. Both need a user gesture, and for touch input only
 * pointerup/touchend count as one (pointerdown does for the mouse only), so the
 * request is made on release. Desktop pointers are ignored; failures are silent
 * because both APIs are optional and vendor-gated. Installed as a PWA (manifest
 * display "fullscreen") none of this is needed.
 */
export function fullscreenOnFirstTouch(): void {
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const el = document.documentElement;
    const request = el.requestFullscreen?.bind(el);
    if (!request || document.fullscreenElement) {
      window.removeEventListener("pointerup", onUp, true);
      return;
    }
    request({ navigationUI: "hide" })
      .then(() => {
        window.removeEventListener("pointerup", onUp, true);
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return o.lock?.("landscape");
      })
      .catch(() => {
        /* refused this time (e.g. no activation yet); try again on the next touch */
      });
  };
  window.addEventListener("pointerup", onUp, true);
}
