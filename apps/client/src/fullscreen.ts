/**
 * Mobile browsers keep their address bar over the game. The first touch on the
 * page asks for fullscreen (allowed only inside a user gesture) and, once in
 * fullscreen, tries to lock the orientation to landscape. Desktop pointers are
 * ignored; failures are silent because both APIs are optional and vendor-gated.
 * Installed as a PWA (manifest display "fullscreen") none of this is needed.
 */
export function fullscreenOnFirstTouch(): void {
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    window.removeEventListener("pointerdown", onDown, true);
    const el = document.documentElement;
    const request = el.requestFullscreen?.bind(el);
    if (!request || document.fullscreenElement) return;
    request({ navigationUI: "hide" })
      .then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return o.lock?.("landscape");
      })
      .catch(() => {
        /* not allowed here; the browser UI stays */
      });
  };
  window.addEventListener("pointerdown", onDown, true);
}
