import type { FloorMod } from "@supermaze/sim";
import { t } from "../i18n/index.js";

/**
 * Words for a tower run special floor (CLAUDE.md 4.1): a short tag for the
 * caption under the clock and a line saying what it does for the floor
 * screens. Empty on an ordinary floor.
 */
export function floorModTags(mods: readonly FloorMod[]): string {
  return mods.map((m) => t(`modes.floor.${m}.tag`)).join(" ");
}

export function floorModLines(mods: readonly FloorMod[]): string[] {
  return mods.map((m) => t(`modes.floor.${m}.line`));
}
