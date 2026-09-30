import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { moverPosition } from "../src/movement.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { canUseSkill, type SkillKind } from "../src/skills.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";
import { walk } from "./walk.js";

const T = NO_FREEZE.tickRate;
const S: PlayerInput = { moveX: 0, moveY: 1 };
const cast: PlayerInput = { moveX: 0, moveY: 0, skill: true };

/** TINY_MAP with the boxes out of the way and a fixed trap on (2,6), two steps south of the first spawn. */
const MAP: MapData = {
  ...TINY_MAP,
  spawns: {
    ...TINY_MAP.spawns,
    keys: [{ x: 7, y: 6, layer: "road" }, { x: 1, y: 1, layer: "road" }, { x: 7, y: 1, layer: "road" }],
    itemBoxes: [{ x: 3, y: 1, layer: "road" }, { x: 4, y: 1, layer: "road" }, { x: 5, y: 1, layer: "road" }, { x: 6, y: 1, layer: "road" }, { x: 2, y: 1, layer: "road" }, { x: 7, y: 3, layer: "road" }],
  },
  fixtures: [{ kind: "trap", x: 2, y: 6, layer: "road" }],
};

function sim(players: { id: string; skill?: SkillKind }[], tuning: Tuning = NO_FREEZE): Simulation {
  const s = new Simulation({
    seed: 1,
    map: MAP,
    teamMode: "solo",
    tuning,
    participants: players.map((p) => ({ id: p.id, teamId: p.id, controller: "human" as const, ...(p.skill ? { skill: p.skill } : {}) })),
  });
  s.start();
  return s;
}

function stepAll(s: Simulation, n: number, inputs = new Map<string, PlayerInput>()) {
  const events: { type: string }[] = [];
  for (let i = 0; i < n; i++) events.push(...s.step(inputs));
  return events;
}

describe("skills", () => {
  it("are cast once; a player without one (every CPU) casts nothing", () => {
    const s = sim([{ id: "a", skill: "eagleEye" }, { id: "b" }]);
    const ev = stepAll(s, 1, new Map([["a", cast], ["b", cast]]));
    expect(ev.filter((e) => e.type === "skillUsed")).toEqual([expect.objectContaining({ playerId: "a", skill: "eagleEye" })]);
    expect(s.getState().players["a"]!.skill).toBeNull();
    expect(s.getState().players["a"]!.skillEffect?.untilTick).toBe(s.getState().tick + DEFAULT_TUNING.skills.eagleEye.durationSec * T);
    expect(stepAll(s, 1, new Map([["a", cast]])).filter((e) => e.type === "skillUsed")).toEqual([]);
  });

  it("cannot be cast during the start freeze or while frozen", () => {
    const withFreeze = new Simulation({ seed: 1, map: MAP, teamMode: "solo", participants: [{ id: "a", teamId: "a", controller: "human", skill: "sprint" }] });
    withFreeze.start();
    expect(stepAll(withFreeze, 1, new Map([["a", cast]])).some((e) => e.type === "skillUsed")).toBe(false);
    const st = withFreeze.getState();
    const a = st.players["a"]!;
    const ctx = { tick: st.freezeUntilTick, freezeUntilTick: st.freezeUntilTick, lightsOn: true, running: true };
    expect(canUseSkill(ctx, a)).toBe(true);
    expect(canUseSkill(ctx, { ...a, frozenUntilTick: ctx.tick + 1 })).toBe(false);
  });

  it("sprint: faster until it runs out", () => {
    const fast = sim([{ id: "a", skill: "sprint" }]);
    const plain = sim([{ id: "a" }]);
    stepAll(fast, 1, new Map([["a", cast]]));
    stepAll(plain, 1);
    const south = new Map([["a", S]]);
    stepAll(fast, 6, south);
    stepAll(plain, 6, south);
    expect(moverPosition(fast.getState().players["a"]!.mover).y).toBeGreaterThan(moverPosition(plain.getState().players["a"]!.mover).y);
    const p = fast.getState().players["a"]!;
    expect(p.skillEffect).toMatchObject({ kind: "sprint" });
    expect(p.skillEffect!.untilTick - fast.getState().tick).toBe(DEFAULT_TUNING.skills.sprint.durationSec * T - 6);
  });

  it("lantern: only in the dark", () => {
    const s = sim([{ id: "a", skill: "lantern" }]);
    const st = s.getState();
    const ctx = { tick: 1, freezeUntilTick: 0, running: true };
    expect(canUseSkill({ ...ctx, lightsOn: true }, st.players["a"]!)).toBe(false);
    expect(canUseSkill({ ...ctx, lightsOn: false }, st.players["a"]!)).toBe(true);
    expect(stepAll(s, 1, new Map([["a", cast]])).some((e) => e.type === "skillUsed")).toBe(false);
    expect(s.getState().players["a"]!.skill).toBe("lantern"); // kept for later
  });

  it("time stop: everyone else in the maze stands still, whatever order they move in", () => {
    const s = sim([{ id: "a" }, { id: "b", skill: "timeStop" }, { id: "c" }]);
    stepAll(s, 1, new Map([["b", cast]]));
    const st = s.getState();
    const until = st.tick + DEFAULT_TUNING.skills.timeStop.freezeSec * T;
    for (const id of ["a", "c"]) expect(st.players[id]).toMatchObject({ frozenUntilTick: until, frozenBy: "skill" });
    expect(st.players["b"]!.frozenUntilTick).toBe(0);
    // Frozen players neither move nor act.
    const before = st.players["a"]!.mover.from;
    stepAll(s, T, new Map([["a", { ...S, action: true }]]));
    expect(s.getState().players["a"]!.mover.from).toEqual(before);
    // Free again once it runs out.
    stepAll(s, until - s.getState().tick);
    walk(s, "a", [S]);
    expect(s.getState().players["a"]!.mover.from).not.toEqual(before);
  });

  it("amulet: a trap springs and vanishes but holds nobody", () => {
    const s = sim([{ id: "a", skill: "amulet" }]);
    stepAll(s, 1, new Map([["a", cast]]));
    expect(s.getState().players["a"]!.shielded).toBe(true);
    const events: { type: string }[] = [];
    const n = Math.ceil(T / DEFAULT_TUNING.movement.speedTilesPerSec) + 4;
    for (let i = 0; i < 2 * n; i++) events.push(...s.step(new Map([["a", S]])));
    expect(events).toContainEqual(expect.objectContaining({ type: "shieldBlocked", playerId: "a", by: "trap" }));
    expect(events.some((e) => e.type === "trapTriggered")).toBe(false);
    const a = s.getState().players["a"]!;
    expect(a.shielded).toBe(false);
    expect(a.frozenUntilTick).toBe(0);
    expect(Object.values(s.getState().placeables)).toHaveLength(0);
  });

  it("amulet: a ghost's catch is shrugged off, nothing lost, nobody scores", () => {
    const FAST: Tuning = {
      ...NO_FREEZE,
      ghostEvent: { ...NO_FREEZE.ghostEvent, intervalSec: 1, warningSec: 1, durationSec: 5, caughtFreezeSec: 1, caughtProtectionSec: 1 },
    };
    // The ghost test's chase: a (first ghost, sorted ids) walks onto b, who waits on (4,3).
    const s = new Simulation({
      seed: 3,
      map: { ...MAP, fixtures: [] },
      tuning: FAST,
      participants: [
        { id: "a", teamId: "A", controller: "human" },
        { id: "b", teamId: "B", controller: "human", skill: "amulet" },
      ],
    });
    s.start();
    stepAll(s, 1, new Map([["b", cast]]));
    stepAll(s, 2 * T - 1);
    expect(s.getState().ghost).toMatchObject({ phase: "active", teamId: "A" });
    stepAll(s, 7, new Map([["b", { moveX: 1, moveY: 0 }]]));
    stepAll(s, 16, new Map([["a", { moveX: 1, moveY: 0 }]]));
    const ev = stepAll(s, 12, new Map([["a", { moveX: 0, moveY: -1 }]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "shieldBlocked", playerId: "b", by: "ghost" }));
    expect(ev.some((e) => e.type === "playerCaught")).toBe(false);
    const b = s.getState().players["b"]!;
    expect(b).toMatchObject({ shielded: false, frozenUntilTick: 0 });
    expect(b.protectedUntilTick).toBeGreaterThan(s.getState().tick);
    expect(s.getState().players["a"]!.score).toBe(0);
  });
});
