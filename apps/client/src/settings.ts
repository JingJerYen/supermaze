/**
 * Player settings kept in this browser, set on the home screen's settings page
 * (`lobby/settingsScreen.ts`). Read when a match builds its input, so a change
 * applies from the next match on.
 */

/** Touch movement: the joystick in the corner (the default), or the four-way pad in the same place. */
export type ControlScheme = "dpad" | "stick";
export const CONTROL_SCHEMES: readonly ControlScheme[] = ["stick", "dpad"];

const CONTROLS_KEY = "supermaze.controls";
let controls: ControlScheme | null = null;

export function loadControls(): ControlScheme {
  if (controls) return controls;
  try {
    controls = localStorage.getItem(CONTROLS_KEY) === "dpad" ? "dpad" : "stick";
  } catch {
    controls = "stick";
  }
  return controls;
}

export function saveControls(scheme: ControlScheme): void {
  controls = scheme;
  try {
    localStorage.setItem(CONTROLS_KEY, scheme);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}
