import type { SimulationState } from "@supermaze/sim";
import { ITEM_LABEL } from "./labels.js";

/**
 * Short centre-screen notices derived by diffing consecutive states, since the
 * client receives state, not events. Kept to what a player needs to react to.
 */
export interface Toast {
  text: string;
  /** Shown larger and longer: somebody reached the tower top, a team finished. */
  big?: boolean;
}

export function diffToasts(prev: SimulationState | null, next: SimulationState, meId: string | null): Toast[] {
  return diffToastTexts(prev, next, meId).map((t) => (typeof t === "string" ? { text: t } : t));
}

function diffToastTexts(prev: SimulationState | null, next: SimulationState, meId: string | null): (string | Toast)[] {
  if (!prev) return [];
  const out: (string | Toast)[] = [];
  const name = (id: string) => next.players[id]?.name ?? id.slice(0, 6);

  for (let i = prev.towerArrivals.length; i < next.towerArrivals.length; i++) {
    const id = next.towerArrivals[i] as string;
    out.push({ text: id === meId ? `你登上塔頂，第 ${i + 1} 名` : `${name(id)} 登上塔頂，第 ${i + 1} 名`, big: true });
  }
  for (const p of Object.values(next.players)) {
    const before = prev.players[p.id];
    if (!before || before.keyId !== null || p.keyId === null) continue;
    // A key that already had an owner was taken by a ghost, not found.
    const victim = prev.keys[p.keyId]?.ownerId ?? null;
    if (victim === null) out.push(p.id === meId ? "🔑 你拿到鑰匙" : `🔑 ${name(p.id)} 拿到鑰匙`);
    else if (p.id === meId) out.push({ text: `👻 你偷走了 ${name(victim)} 的鑰匙`, big: true });
    else if (victim === meId) out.push({ text: `👻 ${name(p.id)} 偷走了你的鑰匙`, big: true });
    else out.push(`👻 ${name(p.id)} 偷走了 ${name(victim)} 的鑰匙`);
  }
  if (prev.lightsOn !== next.lightsOn) out.push(next.lightsOn ? "燈亮了" : "全圖進入黑暗");
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    if (a && b) {
      if (b.items.length > a.items.length) out.push(`取得 ${ITEM_LABEL[b.items[b.items.length - 1] ?? ""] ?? "道具"}`);
      // A ghost catch has its own notice below; this one is for traps.
      if (b.frozenUntilTick > a.frozenUntilTick && b.frozenBy !== "ghost") out.push("踩到陷阱，被鐵籠罩住");
      if (a.teleportImmunity === null && b.teleportImmunity !== null) out.push("傳送");
    }
  }
  if (prev.winnerTeamId === null && next.winnerTeamId !== null && next.status === "running") out.push({ text: "有隊伍全員登頂", big: true });
  if (prev.ghost.phase !== next.ghost.phase) {
    if (next.ghost.phase === "active") out.push("鬼抓人開始");
    if (next.ghost.phase === "idle" && prev.ghost.phase === "active") out.push("鬼抓人結束");
  }
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    if (a && b && b.protectedUntilTick > a.protectedUntilTick && !(a.keyId !== null && b.keyId === null)) out.push("被鬼抓到了，道具全失");
  }
  return out;
}
