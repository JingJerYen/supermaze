import type { SimulationState } from "@supermaze/sim";
import { t } from "../i18n/index.js";
import { ITEM_LABEL, SKILL_INFO } from "./labels.js";

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
  return diffToastTexts(prev, next, meId).map((x) => (typeof x === "string" ? { text: x } : x));
}

function diffToastTexts(prev: SimulationState | null, next: SimulationState, meId: string | null): (string | Toast)[] {
  if (!prev) return [];
  const out: (string | Toast)[] = [];
  const name = (id: string) => next.players[id]?.name ?? id.slice(0, 6);

  // No arrival rank: players took it for the final placing, which goes by score.
  for (let i = prev.towerArrivals.length; i < next.towerArrivals.length; i++) {
    const id = next.towerArrivals[i] as string;
    out.push({ text: id === meId ? t("hud.toast.youClimbed") : t("hud.toast.climbed", { name: name(id) }), big: true });
  }
  for (const p of Object.values(next.players)) {
    const before = prev.players[p.id];
    if (!before || before.keyId !== null || p.keyId === null) continue;
    // A key that already had an owner was taken by a ghost, not found.
    const victim = prev.keys[p.keyId]?.ownerId ?? null;
    if (victim === null) out.push(p.id === meId ? t("hud.toast.youGotKey") : t("hud.toast.gotKey", { name: name(p.id) }));
    else if (p.id === meId) out.push({ text: t("hud.toast.youStole", { victim: name(victim) }), big: true });
    else if (victim === meId) out.push({ text: t("hud.toast.stoleYours", { thief: name(p.id) }), big: true });
    else out.push(t("hud.toast.stole", { thief: name(p.id), victim: name(victim) }));
  }
  if (prev.lightsOn !== next.lightsOn) out.push(t(next.lightsOn ? "hud.toast.lightsOn" : "hud.toast.lightsOff"));
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    if (a && b) {
      if (b.items.length > a.items.length) out.push(t("hud.toast.gotItem", { item: ITEM_LABEL[b.items[b.items.length - 1] ?? ""] ?? t("hud.item.generic") }));
      // A ghost catch has its own notice below; this one is for traps.
      if (b.frozenUntilTick > a.frozenUntilTick && b.frozenBy === "trap") out.push(t("hud.toast.trapped"));
      for (const used of [a.skill && !b.skill ? a.skill : null, a.skill2 && !b.skill2 ? a.skill2 : null]) {
        if (used) out.push({ text: t("hud.skill.used", { icon: SKILL_INFO[used]?.icon ?? "", label: SKILL_INFO[used]?.label ?? t("hud.skill.generic") }), big: true });
      }
      if (a.shielded && !b.shielded) out.push({ text: b.protectedUntilTick > a.protectedUntilTick ? t("hud.toast.amuletGhost") : t("hud.toast.amuletTrap"), big: true });
      if (a.teleportImmunity === null && b.teleportImmunity !== null) out.push(t("hud.toast.teleported"));
    }
  }
  if (prev.winnerTeamId === null && next.winnerTeamId !== null && next.status === "running") out.push({ text: t("hud.toast.teamFinished"), big: true });
  if (prev.ghost.phase !== next.ghost.phase) {
    if (next.ghost.phase === "active") out.push(t("hud.toast.ghostStart"));
    if (next.ghost.phase === "idle" && prev.ghost.phase === "active") out.push(t("hud.toast.ghostEnd"));
  }
  if (meId) {
    const a = prev.players[meId];
    const b = next.players[meId];
    // The amulet raises the protection too, without a catch.
    const shieldTook = !!a && !!b && a.shielded && !b.shielded;
    if (a && b && !shieldTook && b.protectedUntilTick > a.protectedUntilTick && !(a.keyId !== null && b.keyId === null)) out.push(t("hud.toast.caughtByGhost"));
  }
  return out;
}
