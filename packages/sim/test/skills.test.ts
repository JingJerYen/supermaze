import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { moverPosition } from "../src/movement.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { canUseSkill, jumpTarget, type SkillKind } from "../src/skills.js";
import { warpTargets } from "../src/skillEffects.js";
import { movePlayer } from "../src/playerMove.js";
import { tileKey } from "../src/map/grid.js";
import { MapGrid } from "../src/map/grid.js";
import type { PlaceableState } from "../src/placeables.js";
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
    const ctx = { tick: st.freezeUntilTick, freezeUntilTick: st.freezeUntilTick, lightsOn: true, running: true, placeables: {}, ghost: st.ghost, capacity: 3 };
    expect(canUseSkill(ctx, a, MapGrid.fromMapData(MAP))).toBe(true);
    expect(canUseSkill(ctx, { ...a, frozenUntilTick: ctx.tick + 1 }, MapGrid.fromMapData(MAP))).toBe(false);
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
    const ctx = { tick: 1, freezeUntilTick: 0, running: true, placeables: {}, ghost: st.ghost, capacity: 3 };
    expect(canUseSkill({ ...ctx, lightsOn: true }, st.players["a"]!, MapGrid.fromMapData(MAP))).toBe(false);
    expect(canUseSkill({ ...ctx, lightsOn: false }, st.players["a"]!, MapGrid.fromMapData(MAP))).toBe(true);
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

  it("jump: up onto the wall in front, landing a step later", () => {
    // Spawn (2,4); (3,4) is road with the wall (3,5) south of it.
    const s = sim([{ id: "a", skill: "jump" }]);
    walk(s, "a", [{ moveX: 1, moveY: 0 }]);
    expect(stepAll(s, 1, new Map([["a", cast]])).some((e) => e.type === "skillUsed")).toBe(false); // facing the road
    stepAll(s, 1, new Map([["a", S]])); // a tap turns without stepping (the wall is in the way anyway)
    expect(s.getState().players["a"]!.mover).toMatchObject({ from: { x: 3, y: 4, layer: "road" }, facing: { dx: 0, dy: 1 } });
    const ev = stepAll(s, 1, new Map([["a", cast]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "skillUsed", playerId: "a", skill: "jump" }));
    expect(s.getState().players["a"]!.mover.target).toEqual({ x: 3, y: 5, layer: "wallTop" });
    stepAll(s, T);
    expect(s.getState().players["a"]!.mover).toMatchObject({ from: { x: 3, y: 5, layer: "wallTop" }, target: null });
    expect(s.getState().players["a"]!.skill).toBeNull();
  });

  it("jump: only onto the other level, from a standstill, off stairs, and not into an obstacle", () => {
    const s = sim([{ id: "a", skill: "jump" }]);
    const grid = MapGrid.fromMapData(MAP);
    const a = s.getState().players["a"]!;
    const at = (x: number, y: number, layer: "road" | "wallTop", dx: number, dy: number) => ({ ...a, mover: { ...a.mover, from: { x, y, layer }, target: null, facing: { dx, dy } } });
    // Down from a wall top onto the road, either side.
    expect(jumpTarget(grid, {}, at(4, 5, "wallTop", 0, -1))).toEqual({ x: 4, y: 4, layer: "road" });
    expect(jumpTarget(grid, {}, at(5, 5, "wallTop", 1, 0))).toEqual({ x: 6, y: 5, layer: "road" });
    // Same level, the tower, the stairs, and standing on the stairs: no jump.
    expect(jumpTarget(grid, {}, at(3, 4, "road", 1, 0))).toBeNull();
    expect(jumpTarget(grid, {}, at(4, 5, "wallTop", 1, 0))).toBeNull();
    expect(jumpTarget(grid, {}, at(2, 4, "road", 0, -1))).toBeNull();
    expect(jumpTarget(grid, {}, at(2, 4, "road", 0, 1))).toBeNull();
    expect(jumpTarget(grid, {}, at(2, 5, "road", 1, 0))).toBeNull();
    // Mid-step, nothing.
    const walking = at(3, 4, "road", 0, 1);
    expect(jumpTarget(grid, {}, { ...walking, mover: { ...walking.mover, target: { x: 3, y: 5, layer: "wallTop" } } })).toBeNull();
    // An obstacle on the landing blocks it; a trap does not.
    const on = (kind: PlaceableState["kind"]): Record<string, PlaceableState> => ({
      p: { id: "p", kind, pos: { x: 3, y: 5, layer: "wallTop" }, dir: { dx: 0, dy: 1 }, ownerId: null, expiresAtTick: 0, permanent: true },
    });
    expect(jumpTarget(grid, on("obstacle"), at(3, 4, "road", 0, 1))).toBeNull();
    expect(jumpTarget(grid, on("trap"), at(3, 4, "road", 0, 1))).toEqual({ x: 3, y: 5, layer: "wallTop" });
  });

  it("pierce: through an obstacle and over a trap, which stays; a trap springs again once it ends", () => {
    const blocked = { ...MAP, fixtures: [{ kind: "obstacle" as const, x: 2, y: 6, layer: "road" as const }] };
    const run = (skill: boolean) => {
      const s = new Simulation({ seed: 1, map: blocked, teamMode: "solo", tuning: NO_FREEZE, participants: [{ id: "a", teamId: "a", controller: "human", ...(skill ? { skill: "pierce" as const } : {}) }] });
      s.start();
      if (skill) stepAll(s, 1, new Map([["a", cast]]));
      stepAll(s, 3 * T, new Map([["a", S]]));
      return s.getState().players["a"]!.mover.from;
    };
    expect(run(false)).not.toMatchObject({ x: 2, y: 6 });
    expect(run(true)).toMatchObject({ x: 2, y: 6, layer: "road" });

    const s = sim([{ id: "a", skill: "pierce" }]);
    stepAll(s, 1, new Map([["a", cast]]));
    const ev = stepAll(s, 3 * T, new Map([["a", S]]));
    expect(s.getState().players["a"]!.mover.from).toMatchObject({ x: 2, y: 6 });
    expect(ev.some((e) => e.type === "trapTriggered")).toBe(false);
    expect(Object.values(s.getState().placeables)).toHaveLength(1);
    expect(s.getState().players["a"]!.skillEffect).toMatchObject({ kind: "pierce" });
  });

  it("pierce: standing on an obstacle when it runs out, the player can still walk off", () => {
    const grid = MapGrid.fromMapData(MAP);
    const s = sim([{ id: "a" }]);
    const a = s.getState().players["a"]!;
    const on = { ...a, mover: { ...a.mover, from: { x: 2, y: 6, layer: "road" as const }, target: null, facing: { dx: 1, dy: 0 } }, skillEffect: { kind: "pierce" as const, untilTick: 5 } };
    const placeables: Record<string, PlaceableState> = {
      o: { id: "o", kind: "obstacle", pos: { x: 2, y: 6, layer: "road" }, dir: { dx: 0, dy: 1 }, ownerId: null, expiresAtTick: 0, permanent: true },
    };
    const ctx = { tick: 10, status: "running" as const, freezeUntilTick: 0, ghost: s.getState().ghost, placeables };
    const moved = movePlayer(grid, NO_FREEZE, ctx, on, { moveX: 1, moveY: 0 });
    expect(moved.target ?? moved.from).not.toEqual(on.mover.from);
  });

  it("warp: lands on a reachable tile, never stairs, a bridge, the tower ring, a placeable or where it stood; the same seed lands the same", () => {
    const grid = MapGrid.fromMapData(MAP);
    const s = sim([{ id: "a", skill: "warp" }]);
    const a = s.getState().players["a"]!;
    const targets = warpTargets(grid, s.getState().placeables, s.getState().nodes, a);
    const reach = grid.reachableFrom(grid.spawnTiles()[0]!);
    expect(targets.length).toBeGreaterThan(10);
    for (const t of targets) {
      expect(reach.has(tileKey(t.x, t.y, t.layer))).toBe(true);
      expect(["stairs", "bridge"]).not.toContain(grid.kindAt(t.x, t.y));
      expect(t.layer === "road" && grid.isTowerEntry(t.x, t.y)).toBe(false);
      expect(t).not.toEqual(a.mover.from);
      expect(t).not.toEqual({ x: 2, y: 6, layer: "road" }); // the fixed trap
    }
    stepAll(s, 1, new Map([["a", cast]]));
    const landed = s.getState().players["a"]!.mover;
    expect(landed.target).toBeNull();
    expect(targets).toContainEqual(landed.from);
    const again = sim([{ id: "a", skill: "warp" }]);
    stepAll(again, 1, new Map([["a", cast]]));
    expect(again.getState().players["a"]!.mover.from).toEqual(landed.from);
  });

  it("supply: fills the bag, keeps the two-node limit, and is not cast into a full bag", () => {
    const s = sim([{ id: "a", skill: "supply" }]);
    stepAll(s, 1, new Map([["a", cast]]));
    expect(s.getState().players["a"]!.items).toHaveLength(DEFAULT_TUNING.inventory.capacity);

    const onlyNodes: Tuning = { ...NO_FREEZE, itemBoxes: { ...NO_FREEZE.itemBoxes, weights: { hammer: 0, obstacle: 0, oneWayDoor: 0, trap: 0, teleportNode: 1 } } };
    const n = sim([{ id: "a", skill: "supply" }], onlyNodes);
    stepAll(n, 1, new Map([["a", cast]]));
    expect(n.getState().players["a"]!.items).toEqual(["teleportNode", "teleportNode"]);

    const st = s.getState();
    const ctx = { tick: st.tick, freezeUntilTick: 0, lightsOn: true, running: true, placeables: {}, ghost: st.ghost, capacity: 3 };
    const full = { ...st.players["a"]!, skill: "supply" as const };
    expect(canUseSkill(ctx, full, MapGrid.fromMapData(MAP))).toBe(false);
    expect(canUseSkill(ctx, { ...full, items: [] }, MapGrid.fromMapData(MAP))).toBe(true);
  });

  it("two skills (full version): each cast on its own input; one timed effect at a time", () => {
    const s = new Simulation({
      seed: 1,
      map: MAP,
      teamMode: "solo",
      tuning: NO_FREEZE,
      participants: [{ id: "a", teamId: "a", controller: "human", skill: "sprint", skill2: "pierce" }],
    });
    s.start();
    const cast2: PlayerInput = { moveX: 0, moveY: 0, skill2: true };
    expect(stepAll(s, 1, new Map([["a", cast]]))).toContainEqual(expect.objectContaining({ type: "skillUsed", skill: "sprint" }));
    // Pierce waits while the sprint runs.
    expect(stepAll(s, 1, new Map([["a", cast2]])).some((e) => e.type === "skillUsed")).toBe(false);
    expect(s.getState().players["a"]).toMatchObject({ skill: null, skill2: "pierce" });
    stepAll(s, DEFAULT_TUNING.skills.sprint.durationSec * T);
    expect(stepAll(s, 1, new Map([["a", cast2]]))).toContainEqual(expect.objectContaining({ type: "skillUsed", skill: "pierce" }));
    expect(s.getState().players["a"]).toMatchObject({ skill: null, skill2: null, skillEffect: { kind: "pierce" } });
  });
});
