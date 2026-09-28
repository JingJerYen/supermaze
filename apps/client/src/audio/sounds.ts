import { isGhost, type SimulationState } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import type { SoundName } from "./sfx.js";

export interface SoundCue {
  name: SoundName;
  /** Relative volume: your own events are full, other players' are quieter. */
  volume: number;
}

/**
 * What to play for the step from `prev` to `next`, derived from state like the
 * toasts are (clients receive state, not events). Things that happen to the
 * local player play at full volume, the same things happening to others play
 * quietly, and the lights are heard by everyone.
 */
export function diffSounds(prev: SimulationState | null, next: SimulationState, meId: string | null): SoundCue[] {
  if (!prev) return [];
  const others = CLIENT_TUNING.audio.othersVolume;
  const out: SoundCue[] = [];
  const me = meId ? next.players[meId] : undefined;
  const vol = (id: string): number => (id === meId ? 1 : others);

  for (const p of Object.values(next.players)) {
    const before = prev.players[p.id];
    if (!before) continue;
    if (before.keyId === null && p.keyId !== null) out.push({ name: "key", volume: vol(p.id) });
    if (p.id === meId && p.items.length > before.items.length) out.push({ name: "box", volume: 1 });
    if (p.frozenUntilTick > before.frozenUntilTick) {
      if (p.frozenBy === "trap") out.push({ name: "trap", volume: vol(p.id) });
      else if (p.frozenBy === "ghost") {
        // The ghost hears its own catch; the runner and bystanders hear the wail.
        const iCaught = !!me && p.id !== meId && p.teamId !== me.teamId && (isGhost(next.ghost, me) || isGhost(prev.ghost, me));
        out.push(iCaught ? { name: "catch", volume: 1 } : { name: "caught", volume: vol(p.id) });
      }
    }
  }
  for (let i = prev.towerArrivals.length; i < next.towerArrivals.length; i++) {
    out.push({ name: "climb", volume: vol(next.towerArrivals[i] as string) });
  }
  if (prev.lightsOn !== next.lightsOn) out.push({ name: next.lightsOn ? "lightOn" : "lightOff", volume: CLIENT_TUNING.audio.lightsVolume });
  return out;
}
