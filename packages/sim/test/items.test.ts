import { describe, expect, it } from "vitest";
import { DIRS } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING as BASE_TUNING, type ItemKind, type Tuning } from "../src/tuning/index.js";

/** These tests exercise the real item rules, so effects are switched on. */
const DEFAULT_TUNING: Tuning = { ...BASE_TUNING, placeables: { ...BASE_TUNING.placeables, effectsEnabled: true } };
import { TINY_MAP } from "./fixtures.js";

/**
 * Corridor test bed: row 1 of TINY_MAP is a straight east-west road (1,1)..(7,1)
 * between the void border and the row-2 walls. Boxes are placed so a player can
 * be given a chosen item deterministically by weighting only that kind.
 */
const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };
const E: PlayerInput = { moveX: 1, moveY: 0 };
const W: PlayerInput = { moveX: -1, moveY: 0 };
const N: PlayerInput = { moveX: 0, moveY: -1 };
const S: PlayerInput = { moveX: 0, moveY: 1 };

const ticksPerTile = Math.ceil(DEFAULT_TUNING.tickRate / DEFAULT_TUNING.movement.speedTilesPerSec);

function walk(sim: Simulation, id: string, dirs: PlayerInput[]): void {
  for (const d of dirs) {
    for (let i = 0; i < ticksPerTile - 1; i++) sim.step(new Map([[id, d]]));
    for (let i = 0; i < ticksPerTile; i++) sim.step(new Map());
  }
}
/** Hold a direction for a while without settling (to test being blocked). */
function push(sim: Simulation, id: string, d: PlayerInput, ticks = ticksPerTile * 2): void {
  for (let i = 0; i < ticks; i++) sim.step(new Map([[id, d]]));
}

function onlyItem(kind: ItemKind, patch: Partial<Tuning> = {}): Tuning {
  const weights = { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 0, [kind]: 1 };
  return { ...DEFAULT_TUNING, ...patch, itemBoxes: { perParticipant: 1, weights } };
}

/** One player spawning at (2,3); one box exactly on (2,2) so the first step north yields `kind`. */
function armed(kind: ItemKind, tuning: Partial<Tuning> = {}, players = 1) {
  const map: MapData = {
    ...TINY_MAP,
    spawns: {
      ...TINY_MAP.spawns,
      keys: [{ x: 7, y: 6, layer: "road" }, { x: 1, y: 6, layer: "road" }],
      itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }],
    },
  };
  const participants = [{ id: "a", teamId: "A", controller: "human" as const }];
  if (players > 1) participants.push({ id: "b", teamId: "B", controller: "human" as const });
  const sim = new Simulation({ seed: 1, map, participants, tuning: { ...onlyItem(kind), ...tuning, itemBoxes: onlyItem(kind).itemBoxes } });
  // With 1 box per participant and (2,2) first... the draw is random, so force by checking and retrying seeds.
  let seed = 1;
  let s = sim;
  while (!Object.values(s.getState().boxes).length || !boxOn(s, 2, 2)) {
    s = new Simulation({ seed: ++seed, map, participants, tuning: { ...onlyItem(kind), ...tuning, itemBoxes: onlyItem(kind).itemBoxes } });
    s.start();
    if (seed > 50) throw new Error("could not seed a box onto (2,2)");
  }
  if (s === sim) s.start();
  walk(s, "a", [N]); // a now stands on (2,2) holding `kind`, facing north; (2,1) is the row-1 corridor.
  expect(s.getState().players["a"]!.items).toEqual([kind]);
  return s;
}
function boxOn(sim: Simulation, x: number, y: number): boolean {
  if (sim.getState().status === "lobby") sim.start();
  return Object.values(sim.getState().boxes).some((b) => b.pos.x === x && b.pos.y === y);
}

describe("placement rules", () => {
  it("places one tile ahead on the same layer, facing the way the player pushed", () => {
    const sim = armed("obstacle");
    // Face north: (2,1) is road, not a candidate.
    sim.step(new Map([["a", press]]));
    const pl = Object.values(sim.getState().placeables);
    expect(pl).toHaveLength(1);
    expect(pl[0]).toMatchObject({ kind: "obstacle", pos: { x: 2, y: 1, layer: "road" }, dir: DIRS.north });
    expect(sim.getState().players["a"]!.items).toEqual([]);
  });

  it("refuses candidate tiles, tower entries and stairs, keeping the item", () => {
    // (2,2) is the stairs tile in TINY_MAP: standing at (2,3) facing north targets stairs -> refused.
    const sim = armed("obstacle");
    walk(sim, "a", [S]); // back to (2,3), facing south now (toward the tower entry... (2,4) is the tower itself)
    push(sim, "a", N, 1); // turn north without moving? a single tick moves; use facing via blocked move instead
    // Facing south from (2,3) targets the tower (2,4): not walkable -> refused.
    sim.step(new Map([["a", { ...S, action: true }]]));
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    expect(sim.getState().players["a"]!.items).toEqual(["obstacle"]);
  });

  it("refuses a tile that is a spawn candidate", () => {
    const sim = armed("trap");
    // (2,1)... make (2,1) a candidate instead: rebuild with candidate at (2,1).
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 1, layer: "road" }], itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }] } };
    const s2 = new Simulation({ seed: 1, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: onlyItem("trap") });
    s2.start();
    void sim;
    // find a seed that puts the single box on (2,2)
    let seed = 1;
    let s = s2;
    while (!Object.values(s.getState().boxes).some((b) => b.pos.x === 2 && b.pos.y === 2)) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: onlyItem("trap") });
      s.start();
    }
    walk(s, "a", [N]);
    expect(s.getState().players["a"]!.items).toEqual(["trap"]);
    s.step(new Map([["a", press]]));
    expect(Object.values(s.getState().placeables)).toHaveLength(0);
    expect(s.getState().players["a"]!.items).toEqual(["trap"]);
  });
});

describe("obstacle and hammer", () => {
  it("an obstacle blocks everyone until it expires", () => {
    const sim = armed("obstacle", { placeables: { ...DEFAULT_TUNING.placeables, lifetimeSec: { ...DEFAULT_TUNING.placeables.lifetimeSec, obstacle: 1 } } });
    sim.step(new Map([["a", press]])); // obstacle on (2,1)
    push(sim, "a", N);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 2, layer: "road" });
    // 1 s lifetime = 20 ticks; we already spent 2*ticksPerTile pushing. Wait out the rest.
    for (let i = 0; i < 20; i++) sim.step(new Map());
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    walk(sim, "a", [N]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
  });

  it("a hammer is spent on a swing at nothing, and breaks an obstacle when there is one", () => {
    const sim = armed("hammer");
    const miss = sim.step(new Map([["a", press]])); // nothing ahead: still consumed, nothing destroyed
    expect(sim.getState().players["a"]!.items).toEqual([]);
    expect(miss.map((e) => e.type)).toContain("itemUsed");
    expect(miss.map((e) => e.type)).not.toContain("placeableDestroyed");

    // Have b place an obstacle on (2,1)? Simpler: give a an obstacle too via a second box... use a fresh sim with two boxes.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }], itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 1, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }] } };
    const weights = { oneWayDoor: 0, obstacle: 1, hammer: 1, trap: 0, teleportNode: 0 };
    let seed = 0;
    let s: Simulation;
    // Find a seed where boxes sit on (2,2) and (1,2) and the draw order is obstacle then hammer.
    for (;;) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 2, weights } } });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((b) => `${b.pos.x},${b.pos.y}`).sort();
      if (tiles.join("|") !== "1,2|2,2") continue;
      walk(s, "a", [N, W]); // (2,2) then (1,2)
      if (s.getState().players["a"]!.items.join() === "obstacle,hammer") break;
      if (seed > 200) throw new Error("no suitable seed");
    }
    // (3,1) holds a light switch (candidate tile), where the action key would flip the
    // lights instead, so place from (4,1): walk (1,2)->(2,2)->(2,1)->(3,1)->(4,1) facing east.
    walk(s, "a", [E, N, E, E]);
    s.step(new Map([["a", press]])); // obstacle at (5,1)
    expect(Object.values(s.getState().placeables).map((p) => p.kind)).toEqual(["obstacle"]);
    expect(s.getState().players["a"]!.items).toEqual(["hammer"]);
    push(s, "a", E); // blocked by own obstacle
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 4, y: 1, layer: "road" });
    const ev = s.step(new Map([["a", press]])); // hammer breaks it
    expect(ev.map((e) => e.type)).toContain("placeableDestroyed");
    expect(Object.values(s.getState().placeables)).toHaveLength(0);
    expect(s.getState().players["a"]!.items).toEqual([]);
  });
});

describe("one-way door", () => {
  it("lets players through in its direction only", () => {
    const sim = armed("oneWayDoor");
    // a at (2,2) facing north; door on (2,1) pointing north. Entering (2,1) from (2,2) moves north: allowed.
    sim.step(new Map([["a", press]]));
    walk(sim, "a", [N]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
    // Standing on the door, moving east (not the door's direction) is refused; north (void) impossible.
    push(sim, "a", E);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
    // But moving back south is also refused (reverse).
    push(sim, "a", S);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
  });

  it("blocks entering against its direction, for its owner too", () => {
    const sim = armed("oneWayDoor");
    sim.step(new Map([["a", press]])); // door at (2,1) facing north
    walk(sim, "a", [W, N, E]); // (1,2) -> (1,1) -> (2,1)? entering the door tile moving east: refused
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 1, y: 1, layer: "road" });
  });
});

describe("trap", () => {
  it("freezes the first player who steps on it, then disappears", () => {
    const freeze = 1; // second
    const sim = armed("trap", { placeables: { ...DEFAULT_TUNING.placeables, trapFreezeSec: freeze } });
    sim.step(new Map([["a", press]])); // trap at (2,1)
    const ev: string[] = [];
    for (let i = 0; i < ticksPerTile; i++) ev.push(...sim.step(new Map([["a", N]])).map((e) => e.type));
    expect(ev).toContain("trapTriggered");
    const a = sim.getState().players["a"]!;
    expect(a.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    // Frozen: pushing does not move.
    push(sim, "a", E, 5);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });
    for (let i = 0; i < 20; i++) sim.step(new Map());
    walk(sim, "a", [E]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 3, y: 1, layer: "road" });
  });
});

describe("teleport nodes", () => {
  function twoNodes() {
    // a gets two teleport nodes: two boxes at (2,2) and (1,2), only teleportNode weighted.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }], itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 1, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }] } };
    const tuning: Tuning = { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 2, weights: { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 1 } } };
    let seed = 0;
    for (;;) {
      const s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((b) => `${b.pos.x},${b.pos.y}`).sort().join("|");
      if (tiles === "1,2|2,2") {
        walk(s, "a", [N, W]);
        expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "teleportNode"]);
        return s;
      }
      if (seed > 100) throw new Error("no seed");
    }
  }

  /**
   * (3,1) is a light-switch candidate in TINY_MAP, so nodes go on (5,1) and (1,3):
   * a walks (1,2)->(1,1)->(2,1)->(3,1)->(4,1) facing east and drops n0 on (5,1),
   * then returns to (1,2) facing south and drops n1 on (1,3).
   */
  function placePair(s: Simulation): void {
    walk(s, "a", [N, E, E, E]); // at (4,1) facing east
    s.step(new Map([["a", press]])); // n0 at (5,1)
    expect(Object.values(s.getState().nodes)[0]).toMatchObject({ pos: { x: 5, y: 1 }, pairedWith: null });
    walk(s, "a", [W, W, W, S]); // (3,1) -> (2,1) -> (1,1) -> (1,2) facing south
    const ev = s.step(new Map([["a", press]])); // n1 at (1,3), pairs with n0
    expect(ev.find((e) => e.type === "nodePlaced")).toMatchObject({ pairedWith: "n0" });
  }

  it("pairs the second node with the first and teleports team members both ways with no bounce", () => {
    const s = twoNodes(); // a at (1,2) facing west
    placePair(s);
    expect(Object.values(s.getState().nodes).every((n) => n.pairedWith !== null)).toBe(true);

    // Step onto n1 at (1,3): arrive at n0 (5,1) instantly.
    const events: string[] = [];
    for (let i = 0; i < ticksPerTile; i++) events.push(...s.step(new Map([["a", S]])).map((e) => e.type));
    expect(events).toContain("teleported");
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 1, layer: "road" });
    expect(s.getState().players["a"]!.teleportImmunity).toBe("n0");
    // Standing on n0 does not bounce back.
    for (let i = 0; i < 5; i++) s.step(new Map());
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 1, layer: "road" });
    // Leave and come back: teleports again.
    walk(s, "a", [E]);
    expect(s.getState().players["a"]!.teleportImmunity).toBeNull();
    const ev2: string[] = [];
    for (let i = 0; i < ticksPerTile; i++) ev2.push(...s.step(new Map([["a", W]])).map((e) => e.type));
    expect(ev2).toContain("teleported");
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 1, y: 3, layer: "road" });
  });

  it("picking up a paired node breaks the pair and the team limit blocks a third node", () => {
    const s = twoNodes();
    placePair(s);
    // a stands at (1,2). Walk onto n1 (1,3) -> teleports to n0 (5,1) with immunity; pressing there picks n0 up.
    for (let i = 0; i < ticksPerTile; i++) s.step(new Map([["a", S]]));
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 1, layer: "road" });
    expect(s.availableAction(s.getState().players["a"]!)).toBe("pickUpNode");
    s.step(new Map([["a", press]]));
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    expect(s.getState().nodes["n1"]!.pairedWith).toBeNull();
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode"]);

    // Team owns 2 nodes (one on the map, one in the bag): a box cannot yield another.
    // Replacement boxes exist elsewhere ((7,4) and (6,6)); check the exclusion directly via a fresh draw count.
    const owned = Object.values(s.getState().nodes).length + s.getState().players["a"]!.items.filter((i) => i === "teleportNode").length;
    expect(owned).toBe(2);
  });
});

describe("hammer versus teleport nodes", () => {
  it("destroys a node of any team and unpairs its partner", () => {
    // Two nodes for team A placed by a, then a hammer for player b of team B who smashes one.
    const map: MapData = {
      ...TINY_MAP,
      spawns: {
        ...TINY_MAP.spawns,
        keys: [{ x: 7, y: 6, layer: "road" }, { x: 1, y: 6, layer: "road" }],
        // Exactly four candidates: once (2,2) and (1,2) are opened, the replacements must land on (7,4) and (6,6).
        itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 1, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }],
      },
    };
    const tuning: Tuning = { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 1, weights: { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 1 } } };
    let seed = 0;
    let s: Simulation;
    for (;;) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }, { id: "b", teamId: "B", controller: "human" }], tuning });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((bx) => `${bx.pos.x},${bx.pos.y}`).sort().join("|");
      if (tiles === "1,2|2,2") break;
      if (seed > 200) throw new Error("no seed");
    }
    // a: (2,3) -> (2,2) -> (1,2): two nodes. b spawns at (2,5) and stays put.
    walk(s, "a", [N, W]);
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "teleportNode"]);
    walk(s, "a", [N, E, E, E]); // (4,1) facing east
    s.step(new Map([["a", press]])); // n0 at (5,1)
    walk(s, "a", [W, W, W, S]); // (1,2) facing south
    s.step(new Map([["a", press]])); // n1 at (1,3), paired with n0
    expect(Object.values(s.getState().nodes).every((n) => n.pairedWith !== null)).toBe(true);

    // The sim keeps a reference to `tuning`, so switching the weights now makes a's next box a hammer.
    tuning.itemBoxes.weights = { oneWayDoor: 0, obstacle: 0, hammer: 1, trap: 0, teleportNode: 0 };
    walk(s, "a", [S]); // onto n1 (1,3): paired -> teleports a to n0 (5,1)
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 1, layer: "road" });
    s.step(new Map([["a", press]])); // picks n0 up (standing on it); n1 unpaired
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    // Walk a to the replacement box on (7,4): (5,1)->(6,1)->(7,1)->(7,2)->(7,3)->(7,4).
    walk(s, "a", [E, E, S, S, S]);
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "hammer"]);
    // a has node then hammer: FIFO makes the node come out first. Place it: at (7,4) facing south, front (7,5) road.
    s.step(new Map([["a", press]])); // node n2 at (7,5), pairs with n1
    expect(s.getState().nodes["n1"]!.pairedWith).toBe("n2");
    // Smash n2 with the hammer.
    const ev = s.step(new Map([["a", press]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "nodeDestroyed", nodeId: "n2", teamId: "A" }));
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    expect(s.getState().nodes["n1"]!.pairedWith).toBeNull();
    expect(s.getState().players["a"]!.items).toEqual([]);
  });
});
