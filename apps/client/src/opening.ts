import { DEFAULT_TUNING, type SimulationState } from "@supermaze/sim";

/**
 * The start freeze seen as the opening (CLAUDE.md section 4): first the camera
 * flies in, then 3-2-1. The simulation only knows when the freeze ends; the
 * countdown is always the last `round.startFreezeSec` of it and the fly-in is
 * whatever comes before.
 */
export interface Opening {
  /** Length of the fly-in, ticks; 0 when there is none. */
  introTicks: number;
  /** Seconds of fly-in left; 0 once the countdown has begun. */
  introLeftSec: number;
  /** Seconds of countdown left; 0 during the fly-in and after release. */
  countdownSec: number;
  /** 0..1 through the countdown (doors opening), null when there is no freeze to show. */
  countdownProgress: number | null;
}

const NONE: Opening = { introTicks: 0, introLeftSec: 0, countdownSec: 0, countdownProgress: null };

export function openingOf(state: SimulationState, tickRate: number): Opening {
  if (state.status !== "running") return NONE;
  const total = state.freezeUntilTick - state.startTick;
  if (total <= 0) return NONE;
  const countdownTicks = Math.min(total, Math.round(DEFAULT_TUNING.round.startFreezeSec * tickRate));
  const introTicks = total - countdownTicks;
  const introEnd = state.startTick + introTicks;
  const inIntro = state.tick < introEnd;
  return {
    introTicks,
    introLeftSec: inIntro ? (introEnd - state.tick) / tickRate : 0,
    countdownSec: inIntro ? 0 : Math.max(0, state.freezeUntilTick - state.tick) / tickRate,
    countdownProgress:
      state.tick < state.freezeUntilTick + 2 && countdownTicks > 0 ? Math.min(1, Math.max(0, (state.tick - introEnd) / countdownTicks)) : null,
  };
}
