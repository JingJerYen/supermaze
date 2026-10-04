import { CLIENT_TUNING } from "../tuning.js";

/**
 * Whether to draw the maze dark this frame. Night parade (CLAUDE.md 4.4): the
 * lights a switch turned on go out again at `offAtTick`; over the last
 * `nightLights.flickerSec` they flicker, dark more and more of the time, so the
 * player sees it coming. Pure, so it is tested without a renderer.
 */
export function drawDark(lightsOn: boolean, offAtTick: number | undefined, tick: number, tickRate: number, nowSec: number): boolean {
  if (!lightsOn) return true;
  if (offAtTick === undefined) return false;
  const t = CLIENT_TUNING.nightLights;
  const left = (offAtTick - tick) / tickRate;
  if (left > t.flickerSec || left <= 0) return false;
  // From a quarter of the time dark at the start of the flicker to nearly all of it at the end.
  const share = 0.25 + 0.65 * (1 - left / t.flickerSec);
  const phase = (nowSec * t.flickerHz) % 1;
  return phase < share;
}
