import type { SimEvent } from "./events.js";
import { isGhost, type GhostState } from "./ghost.js";
import type { KeyState } from "./keys.js";
import { moverPosition } from "./movement.js";
import type { PlayerState } from "./state.js";
import type { Tuning } from "./tuning/index.js";
import type { PlayerId, Tick } from "./types.js";

/** How a round treats a catch, beyond the shared rule. */
export interface CatchRules {
  /** A ghost without a key takes the runner's (section 13). Off where ghosts never climb. */
  stealKeys: boolean;
}

/**
 * Ghost catches for one tick (section 13): a ghost within the catch radius of
 * an unprotected runner on the same layer freezes them and empties their bag;
 * the amulet takes the catch instead. Works on `players` and `keys` in place
 * (both are this tick's working copies) and returns the runners caught.
 */
export function resolveCatches(
  players: Record<PlayerId, PlayerState>,
  keys: Record<string, KeyState>,
  ghost: GhostState,
  tick: Tick,
  tuning: Tuning,
  events: SimEvent[],
  rules: CatchRules,
): { keys: Record<string, KeyState>; caught: PlayerId[] } {
  const caught: PlayerId[] = [];
  if (ghost.phase !== "active") return { keys, caught };
  const radius = tuning.ghostEvent.catchRadiusTiles;
  const sec = (s: number) => Math.round(s * tuning.tickRate);
  const ghosts = Object.values(players).filter((p) => isGhost(ghost, p)).sort((a, b) => a.id.localeCompare(b.id));
  for (const g of ghosts) {
    const gp = moverPosition(g.mover);
    for (const r of Object.values(players).sort((a, b) => a.id.localeCompare(b.id))) {
      // Ghosts never catch ghosts (in a pack round they are all on different teams).
      if (r.phase !== "maze" || isGhost(ghost, r) || tick < r.protectedUntilTick) continue;
      if (r.mover.from.layer !== g.mover.from.layer) continue;
      const rp = moverPosition(r.mover);
      if (Math.hypot(rp.x - gp.x, rp.y - gp.y) > radius) continue;
      if (r.shielded) {
        // The amulet takes the catch: nothing lost, nobody scores, and the usual protection follows.
        players[r.id] = { ...r, shielded: false, protectedUntilTick: tick + sec(tuning.ghostEvent.caughtProtectionSec) };
        events.push({ type: "shieldBlocked", tick, playerId: r.id, by: "ghost" });
        continue;
      }
      const frozenUntilTick = tick + sec(tuning.ghostEvent.caughtFreezeSec);
      const protectedUntilTick = frozenUntilTick + sec(tuning.ghostEvent.caughtProtectionSec);
      // A ghost without a key takes the runner's (section 13); a ghost that has one leaves it.
      const scorer = players[g.id] as PlayerState;
      const stolenKeyId = rules.stealKeys && scorer.keyId === null ? r.keyId : null;
      players[r.id] = {
        ...r,
        items: [], // everything carried is lost, teleport nodes included
        keyId: stolenKeyId === null ? r.keyId : null,
        frozenUntilTick,
        frozenBy: "ghost",
        protectedUntilTick,
        mover: { ...r.mover, target: null, progress: 0 },
      };
      // Stealing pays the catch only, never the finder's score.
      players[g.id] = { ...scorer, keyId: stolenKeyId ?? scorer.keyId, score: scorer.score + tuning.scoring.ghostCatch };
      if (stolenKeyId !== null) {
        const key = keys[stolenKeyId];
        if (key) keys = { ...keys, [stolenKeyId]: { ...key, ownerId: g.id } };
      }
      caught.push(r.id);
      events.push({ type: "playerCaught", tick, ghostId: g.id, runnerId: r.id, frozenUntilTick, stolenKeyId });
    }
  }
  return { keys, caught };
}
