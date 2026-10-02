/**
 * Mobile browsers: block pull-to-refresh and double-tap zoom on the play area.
 * Returns the function that removes the guard.
 */
export function guardPageGestures(): () => void {
  const onTouchStart = (e: TouchEvent) => {
    if (!onUiElement(e)) e.preventDefault();
  };
  window.addEventListener("touchstart", onTouchStart, { passive: false });
  return () => window.removeEventListener("touchstart", onTouchStart);
}

/** Presses on buttons, inputs or overlay panels belong to those elements, not to the play area. */
export function onUiElement(e: Event): boolean {
  const target = e.target as HTMLElement | null;
  return !!target?.closest?.("button, input, select, a, .rs, .lb");
}
