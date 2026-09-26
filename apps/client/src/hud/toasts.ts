import type { SimulationState } from "@supermaze/sim";
import { ITEM_LABEL } from "./labels.js";

/**
 * Short centre-screen notices derived by diffing consecutive states, since the
 * client receives state, not events. Kept to what a player needs to react to.
 */
export function diffToasts(prev: SimulationState | null, next: SimulationState, meId: string | null): string[] {
  if (!prev) return [];
  const out: string[] = [];
  const name = (id: string) => next.players[id]?.name ?? id.slice(0, 6);

  for (let i = prev.towerArrivals.length; i < next.towerArrivals.length; i++) {
    const id = next.towerArrivals[i] as string;
    out.push(`${name(id)} 登上塔頂，第 ${i + 1} 名`);
  }
  if (prev.lightsOn !== next.lightsOn) out.push(next.lightsOn ? "燈亮了" : "全圖進入黑暗");
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    if (a && b) {
      if (a.keyId === null && b.keyId !== null) out.push("拿到鑰匙");
      if (b.items.length > a.items.length) out.push(`取得 ${ITEM_LABEL[b.items[b.items.length - 1] ?? ""] ?? "道具"}`);
      if (b.frozenUntilTick > a.frozenUntilTick) out.push("踩到陷阱，暫時無法移動");
      if (a.teleportImmunity === null && b.teleportImmunity !== null) out.push("傳送");
    }
  }
  if (prev.winnerTeamId === null && next.winnerTeamId !== null) out.push("有隊伍全員登頂");
  if (prev.ghost.phase !== next.ghost.phase) {
    if (next.ghost.phase === "active") out.push("鬼抓人開始");
    if (next.ghost.phase === "idle" && prev.ghost.phase === "active") out.push("鬼抓人結束");
  }
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    if (a && b && b.protectedUntilTick > a.protectedUntilTick) out.push("被鬼抓到了，道具全失");
  }
  return out;
}
