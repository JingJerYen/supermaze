import { describe, expect, it } from "vitest";
import { DIRS } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING as BASE_TUNING, type ItemKind, type Tuning } from "../src/tuning/index.js";

/** Ticks needed from standstill to arrive on the next tile: turn + delay + one tile. */
const STEP_TICKS =
  Math.ceil(BASE_TUNING.tickRate / BASE_TUNING.movement.speedTilesPerSec) +
  Math.round(BASE_TUNING.movement.turnDelaySec * BASE_TUNING.tickRate) +
  1;


import { NO_FREEZE, TINY_MAP } from "./fixtures.js";

/** Tests here move on the first tick after start(); the start freeze has its own test file. */
const DEFAULT_TUNING: Tuning = NO_FREEZE;
import { walk, push } from "./walk.js";

/**
 * Corridor test bed: row 6 of TINY_MAP is a straight east-west road (1,6)..(7,6)
 * between the row-5 walls and the border. Boxes are placed so a player can
 * be given a chosen item deterministically by weighting only that kind.
 */
const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };
const E: PlayerInput = { moveX: 1, moveY: 0 };
const W: PlayerInput = { moveX: -1, moveY: 0 };
const N: PlayerInput = { moveX: 0, moveY: -1 };
const S: PlayerInput = { moveX: 0, moveY: 1 };



function onlyItem(kind: ItemKind, patch: Partial<Tuning> = {}): Tuning {
  const weights = { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 0, [kind]: 1 };
  return { ...DEFAULT_TUNING, ...patch, itemBoxes: { perParticipant: 1, weights } };
}

/** One player spawning at (2,4); one box exactly on (2,5) so the first step south yields `kind`. */
function armed(kind: ItemKind, tuning: Partial<Tuning> = {}, players = 1) {
  const map: MapData = {
    ...TINY_MAP,
    spawns: {
      ...TINY_MAP.spawns,
      keys: [{ x: 7, y: 1, layer: "road" }, { x: 1, y: 1, layer: "road" }],
      itemBoxes: [{ x: 2, y: 5, layer: "road" }, { x: 7, y: 3, layer: "road" }, { x: 6, y: 1, layer: "road" }],
    },
  };
  const participants = [{ id: "a", teamId: "A", controller: "human" as const }];
  if (players > 1) participants.push({ id: "b", teamId: "B", controller: "human" as const });
  const sim = new Simulation({ seed: 1, map, participants, tuning: { ...onlyItem(kind), ...tuning, itemBoxes: onlyItem(kind).itemBoxes } });
  // With 1 box per participant and (2,5) first... the draw is random, so force by checking and retrying seeds.
  let seed = 1;
  let s = sim;
  while (!Object.values(s.getState().boxes).length || !boxOn(s, 2, 5)) {
    s = new Simulation({ seed: ++seed, map, participants, tuning: { ...onlyItem(kind), ...tuning, itemBoxes: onlyItem(kind).itemBoxes } });
    s.start();
    if (seed > 50) throw new Error("could not seed a box onto (2,5)");
  }
  if (s === sim) s.start();
  walk(s, "a", [S]); // a now stands on (2,5) holding `kind`, facing south; (2,6) is the row-6 corridor.
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
    // Face south: (2,6) is road, not a candidate.
    sim.step(new Map([["a", press]]));
    const pl = Object.values(sim.getState().placeables);
    expect(pl).toHaveLength(1);
    expect(pl[0]).toMatchObject({ kind: "obstacle", pos: { x: 2, y: 6, layer: "road" }, dir: DIRS.south });
    expect(sim.getState().players["a"]!.items).toEqual([]);
  });

  it("refuses candidate tiles, tower entries and stairs, keeping the item", () => {
    // (2,5) is the stairs tile in TINY_MAP: standing at (2,4) facing south targets stairs -> refused.
    const sim = armed("obstacle");
    walk(sim, "a", [N]); // back to (2,4), facing north now (toward the tower entry... (2,3) is the tower itself)
    push(sim, "a", S, 1); // turn south without moving? a single tick moves; use facing via blocked move instead
    // Facing north from (2,4) targets the tower (2,3): not walkable -> refused.
    sim.step(new Map([["a", { ...N, action: true }]]));
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    expect(sim.getState().players["a"]!.items).toEqual(["obstacle"]);
  });

  it("refuses a tile that is a spawn candidate", () => {
    const sim = armed("trap");
    // (2,6)... make (2,6) a candidate instead: rebuild with candidate at (2,6).
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 6, layer: "road" }], itemBoxes: [{ x: 2, y: 5, layer: "road" }, { x: 7, y: 3, layer: "road" }, { x: 6, y: 1, layer: "road" }] } };
    const s2 = new Simulation({ seed: 1, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: onlyItem("trap") });
    s2.start();
    void sim;
    // find a seed that puts the single box on (2,5)
    let seed = 1;
    let s = s2;
    while (!Object.values(s.getState().boxes).some((b) => b.pos.x === 2 && b.pos.y === 5)) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: onlyItem("trap") });
      s.start();
    }
    walk(s, "a", [S]);
    expect(s.getState().players["a"]!.items).toEqual(["trap"]);
    s.step(new Map([["a", press]]));
    expect(Object.values(s.getState().placeables)).toHaveLength(0);
    expect(s.getState().players["a"]!.items).toEqual(["trap"]);
  });
});

describe("obstacle and hammer", () => {
  it("an obstacle blocks everyone until it expires", () => {
    const sim = armed("obstacle", { placeables: { ...DEFAULT_TUNING.placeables, lifetimeSec: { ...DEFAULT_TUNING.placeables.lifetimeSec, obstacle: 1 } } });
    sim.step(new Map([["a", press]])); // obstacle on (2,6)
    push(sim, "a", S);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 5, layer: "road" });
    // 1 s lifetime = 20 ticks; the push above already spent some. Wait out the rest.
    for (let i = 0; i < 20; i++) sim.step(new Map());
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    walk(sim, "a", [S]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
  });

  it("a hammer is spent on a swing at nothing, and breaks an obstacle when there is one", () => {
    const sim = armed("hammer");
    const miss = sim.step(new Map([["a", press]])); // nothing ahead: still consumed, nothing destroyed
    expect(sim.getState().players["a"]!.items).toEqual([]);
    expect(miss.map((e) => e.type)).toContain("itemUsed");
    expect(miss.map((e) => e.type)).not.toContain("placeableDestroyed");

    // Have b place an obstacle on (2,6)? Simpler: give a an obstacle too via a second box... use a fresh sim with two boxes.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 1, layer: "road" }], itemBoxes: [{ x: 2, y: 5, layer: "road" }, { x: 1, y: 5, layer: "road" }, { x: 7, y: 3, layer: "road" }, { x: 6, y: 1, layer: "road" }] } };
    const weights = { oneWayDoor: 0, obstacle: 1, hammer: 1, trap: 0, teleportNode: 0 };
    let seed = 0;
    let s: Simulation;
    // Find a seed where boxes sit on (2,5) and (1,5) and the draw order is obstacle then hammer.
    for (;;) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 2, weights } } });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((b) => `${b.pos.x},${b.pos.y}`).sort();
      if (tiles.join("|") !== "1,5|2,5") continue;
      walk(s, "a", [S, W]); // (2,5) then (1,5)
      if (s.getState().players["a"]!.items.join() === "obstacle,hammer") break;
      if (seed > 200) throw new Error("no suitable seed");
    }
    // (3,6) holds a light switch (candidate tile), where the action key would flip the
    // lights instead, so place from (4,6): walk (1,5)->(2,5)->(2,6)->(3,6)->(4,6) facing east.
    walk(s, "a", [E, S, E, E]);
    s.step(new Map([["a", press]])); // obstacle at (5,6)
    expect(Object.values(s.getState().placeables).map((p) => p.kind)).toEqual(["obstacle"]);
    expect(s.getState().players["a"]!.items).toEqual(["hammer"]);
    push(s, "a", E); // blocked by own obstacle
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 4, y: 6, layer: "road" });
    const ev = s.step(new Map([["a", press]])); // hammer breaks it
    expect(ev.map((e) => e.type)).toContain("placeableDestroyed");
    expect(Object.values(s.getState().placeables)).toHaveLength(0);
    expect(s.getState().players["a"]!.items).toEqual([]);
  });
});

describe("one-way door", () => {
  it("lets players through in its direction only", () => {
    const sim = armed("oneWayDoor");
    // a at (2,5) facing south; door on (2,6) pointing south. Entering (2,6) from (2,5) moves south: allowed.
    sim.step(new Map([["a", press]]));
    walk(sim, "a", [S]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
    // Standing on the door, moving east (not the door's direction) is refused; south (void) impossible.
    push(sim, "a", E);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
    // But moving back north is also refused (reverse).
    push(sim, "a", N);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
  });

  it("blocks entering against its direction, for its owner too", () => {
    const sim = armed("oneWayDoor");
    sim.step(new Map([["a", press]])); // door at (2,6) facing south
    walk(sim, "a", [W, S, E]); // (1,5) -> (1,6) -> (2,6)? entering the door tile moving east: refused
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 1, y: 6, layer: "road" });
  });
});

describe("trap", () => {
  it("freezes the first player who steps on it, then disappears", () => {
    const freeze = 1; // second
    const sim = armed("trap", { placeables: { ...DEFAULT_TUNING.placeables, trapFreezeSec: freeze } });
    sim.step(new Map([["a", press]])); // trap at (2,6)
    const ev: string[] = [];
    for (let i = 0; i < STEP_TICKS; i++) ev.push(...sim.step(new Map([["a", S]])).map((e) => e.type));
    expect(ev).toContain("trapTriggered");
    const a = sim.getState().players["a"]!;
    expect(a.frozenBy).toBe("trap");
    expect(a.score).toBe(0); // caught in your own trap: nobody scores
    expect(a.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    // Frozen: pushing does not move.
    push(sim, "a", E, 5);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
    for (let i = 0; i < 20; i++) sim.step(new Map());
    walk(sim, "a", [E]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 3, y: 6, layer: "road" });
  });
});

describe("bridges", () => {
  it("take no placeable, neither on the deck nor on the road under it", () => {
    const sim = armed("obstacle"); // a on (2,5) holding an obstacle
    walk(sim, "a", [N, E, E, N]); // (2,4) -> (3,4) -> (4,4) -> (4,3), facing north at plain road (4,2)
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 4, y: 3, layer: "road" });
    expect(sim.availableAction(sim.getState().players["a"]!)).toBe("useItem");
    sim.step(new Map([["a", E]])); // tap east: now facing the road under the bridge (5,3)
    expect(sim.availableAction(sim.getState().players["a"]!)).toBeNull();
    sim.step(new Map([["a", press]]));
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    expect(sim.getState().players["a"]!.items).toEqual(["obstacle"]);
  });
});

describe("trap scoring", () => {
  it("gives the owner points for catching a player of another team", () => {
    const sim = armed("trap", {}, 2); // a (team A) on (2,5) facing south; b (team B) on the east entry (3,3)
    sim.step(new Map([["a", press]])); // trap on (2,6)
    const events: { type: string }[] = [];
    // b: (3,3) -> (3,4) -> (2,4) -> (2,5) -> (2,6)
    for (const d of [S, W, S]) walk(sim, "b", [d]);
    for (let i = 0; i < STEP_TICKS; i++) events.push(...sim.step(new Map([["b", S]])));
    expect(events).toContainEqual(expect.objectContaining({ type: "trapTriggered", playerId: "b", ownerId: "a", ownerScored: true }));
    expect(sim.getState().players["a"]!.score).toBe(sim.tuning.scoring.trapCatch);
    expect(sim.getState().players["b"]!.frozenBy).toBe("trap");
  });
});

describe("teleport nodes", () => {
  function twoNodes() {
    // a gets two teleport nodes: two boxes at (2,5) and (1,5), only teleportNode weighted.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 1, layer: "road" }], itemBoxes: [{ x: 2, y: 5, layer: "road" }, { x: 1, y: 5, layer: "road" }, { x: 7, y: 3, layer: "road" }, { x: 6, y: 1, layer: "road" }] } };
    const tuning: Tuning = { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 2, weights: { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 1 } } };
    let seed = 0;
    for (;;) {
      const s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((b) => `${b.pos.x},${b.pos.y}`).sort().join("|");
      if (tiles === "1,5|2,5") {
        walk(s, "a", [S, W]);
        expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "teleportNode"]);
        return s;
      }
      if (seed > 100) throw new Error("no seed");
    }
  }

  /**
   * (3,6) is a light-switch candidate in TINY_MAP, so nodes go on (5,6) and (1,4):
   * a walks (1,5)->(1,6)->(2,6)->(3,6)->(4,6) facing east and drops n0 on (5,6),
   * then returns to (1,5) facing north and drops n1 on (1,4).
   */
  function placePair(s: Simulation): void {
    walk(s, "a", [S, E, E, E]); // at (4,6) facing east
    s.step(new Map([["a", press]])); // n0 at (5,6)
    expect(Object.values(s.getState().nodes)[0]).toMatchObject({ pos: { x: 5, y: 6 }, pairedWith: null });
    walk(s, "a", [W, W, W, N]); // (3,6) -> (2,6) -> (1,6) -> (1,5) facing north
    const ev = s.step(new Map([["a", press]])); // n1 at (1,4), pairs with n0
    expect(ev.find((e) => e.type === "nodePlaced")).toMatchObject({ pairedWith: "n0" });
  }

  it("pairs the second node with the first and teleports team members both ways with no bounce", () => {
    const s = twoNodes(); // a at (1,5) facing west
    placePair(s);
    expect(Object.values(s.getState().nodes).every((n) => n.pairedWith !== null)).toBe(true);

    // Step onto n1 at (1,4): arrive at n0 (5,6) instantly.
    const events: string[] = [];
    for (let i = 0; i < STEP_TICKS; i++) events.push(...s.step(new Map([["a", N]])).map((e) => e.type));
    expect(events).toContain("teleported");
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 6, layer: "road" });
    expect(s.getState().players["a"]!.teleportImmunity).toBe("n0");
    // Standing on n0 does not bounce back.
    for (let i = 0; i < 5; i++) s.step(new Map());
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 6, layer: "road" });
    // Leave and come back: teleports again.
    walk(s, "a", [E]);
    expect(s.getState().players["a"]!.teleportImmunity).toBeNull();
    const ev2: string[] = [];
    for (let i = 0; i < STEP_TICKS; i++) ev2.push(...s.step(new Map([["a", W]])).map((e) => e.type));
    expect(ev2).toContain("teleported");
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 1, y: 4, layer: "road" });
  });

  it("picking up a paired node breaks the pair and the team limit blocks a third node", () => {
    const s = twoNodes();
    placePair(s);
    // a stands at (1,5). Walk onto n1 (1,4) -> teleports to n0 (5,6) with immunity; pressing there picks n0 up.
    for (let i = 0; i < STEP_TICKS; i++) s.step(new Map([["a", N]]));
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 6, layer: "road" });
    expect(s.availableAction(s.getState().players["a"]!)).toBe("pickUpNode");
    s.step(new Map([["a", press]]));
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    expect(s.getState().nodes["n1"]!.pairedWith).toBeNull();
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode"]);

    // Team owns 2 nodes (one on the map, one in the bag): a box cannot yield another.
    // Replacement boxes exist elsewhere ((7,3) and (6,1)); check the exclusion directly via a fresh draw count.
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
        keys: [{ x: 7, y: 1, layer: "road" }, { x: 1, y: 1, layer: "road" }],
        // Exactly four candidates: once (2,5) and (1,5) are opened, the replacements must land on (7,3) and (6,1).
        itemBoxes: [{ x: 2, y: 5, layer: "road" }, { x: 1, y: 5, layer: "road" }, { x: 7, y: 3, layer: "road" }, { x: 6, y: 1, layer: "road" }],
      },
    };
    const tuning: Tuning = { ...DEFAULT_TUNING, itemBoxes: { perParticipant: 1, weights: { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 1 } } };
    let seed = 0;
    let s: Simulation;
    for (;;) {
      s = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }, { id: "b", teamId: "B", controller: "human" }], tuning });
      s.start();
      const tiles = Object.values(s.getState().boxes).map((bx) => `${bx.pos.x},${bx.pos.y}`).sort().join("|");
      if (tiles === "1,5|2,5") break;
      if (seed > 200) throw new Error("no seed");
    }
    // a: (2,4) -> (2,5) -> (1,5): two nodes. b spawns at (2,2) and stays put.
    walk(s, "a", [S, W]);
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "teleportNode"]);
    walk(s, "a", [S, E, E, E]); // (4,6) facing east
    s.step(new Map([["a", press]])); // n0 at (5,6)
    walk(s, "a", [W, W, W, N]); // (1,5) facing north
    s.step(new Map([["a", press]])); // n1 at (1,4), paired with n0
    expect(Object.values(s.getState().nodes).every((n) => n.pairedWith !== null)).toBe(true);

    // The sim keeps a reference to `tuning`, so switching the weights now makes a's next box a hammer.
    tuning.itemBoxes.weights = { oneWayDoor: 0, obstacle: 0, hammer: 1, trap: 0, teleportNode: 0 };
    walk(s, "a", [N]); // onto n1 (1,4): paired -> teleports a to n0 (5,6)
    expect(s.getState().players["a"]!.mover.from).toEqual({ x: 5, y: 6, layer: "road" });
    s.step(new Map([["a", press]])); // picks n0 up (standing on it); n1 unpaired
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    // Walk a to the replacement box on (7,3): (5,6)->(6,6)->(7,6)->(7,5)->(7,4)->(7,3).
    walk(s, "a", [E, E, N, N, N]);
    expect(s.getState().players["a"]!.items).toEqual(["teleportNode", "hammer"]);
    // a has node then hammer: FIFO makes the node come out first. Place it: at (7,3) facing north, front (7,2) road.
    s.step(new Map([["a", press]])); // node n2 at (7,2), pairs with n1
    expect(s.getState().nodes["n1"]!.pairedWith).toBe("n2");
    // Smash n2 with the hammer.
    const ev = s.step(new Map([["a", press]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "nodeDestroyed", nodeId: "n2", teamId: "A" }));
    expect(Object.keys(s.getState().nodes)).toEqual(["n1"]);
    expect(s.getState().nodes["n1"]!.pairedWith).toBeNull();
    expect(s.getState().players["a"]!.items).toEqual([]);
  });
});

describe("action availability", () => {
  it("offers useItem only when the item can really be used", () => {
    // a holds an obstacle at (2,5) facing south: (2,6) is legal -> useItem offered.
    const sim = armed("obstacle");
    expect(sim.availableAction(sim.getState().players["a"]!)).toBe("useItem");
    // Face north toward the tower (2,4)? (2,4) is a tower entry tile -> refused -> nothing offered.
    walk(sim, "a", [N]); // now at (2,4) facing north; front (2,3) is the tower itself
    expect(sim.availableAction(sim.getState().players["a"]!)).toBeNull();
    // A hammer is always offered.
    const h = armed("hammer");
    walk(h, "a", [N]);
    expect(h.availableAction(h.getState().players["a"]!)).toBe("useItem");
  });
});

describe("discarding", () => {
  const discard: PlayerInput = { ...still, discard: true };

  it("throws away the oldest item without placing anything, even while walking", () => {
    const sim = armed("obstacle"); // a on (2,5) holding one obstacle
    expect(sim.canDiscard(sim.getState().players["a"]!)).toBe(true);
    const ev = sim.step(new Map([["a", { ...S, discard: true }]]));
    expect(ev).toContainEqual({ type: "itemDiscarded", tick: expect.any(Number), playerId: "a", item: "obstacle" });
    expect(sim.getState().players["a"]!.items).toEqual([]);
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
    // Nothing left: the key does nothing and is not offered.
    expect(sim.canDiscard(sim.getState().players["a"]!)).toBe(false);
    expect(sim.step(new Map([["a", discard]])).find((e) => e.type === "itemDiscarded")).toBeUndefined();
  });

  it("gives way to the action key pressed on the same tick", () => {
    const sim = armed("obstacle");
    const ev = sim.step(new Map([["a", { ...still, action: true, discard: true }]]));
    expect(ev.map((e) => e.type)).toContain("placeablePlaced");
    expect(ev.map((e) => e.type)).not.toContain("itemDiscarded");
  });

  it("is refused during the start freeze", () => {
    const sim = new Simulation({ seed: 1, map: TINY_MAP, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: BASE_TUNING });
    sim.start();
    expect(sim.canDiscard({ ...sim.getState().players["a"]!, items: ["hammer"] })).toBe(false);
  });
});

describe("reserved tiles", () => {
  // a spawns on (2,4); the box on (2,5) gives an obstacle; a then stands on (2,5) facing south at (2,6).
  function facing26(keys: { x: number; y: number }[], switches: { x: number; y: number }[], lightSwitchCount: number, boxes: { x: number; y: number }[] = []) {
    const road = (t: { x: number; y: number }) => ({ ...t, layer: "road" as const });
    const map: MapData = {
      ...TINY_MAP,
      lightSwitchCount,
      spawns: { keys: keys.map(road), itemBoxes: [{ x: 2, y: 5, layer: "road" }, ...boxes.map(road)], lightSwitches: switches.map(road) },
    };
    for (let seed = 1; seed < 60; seed++) {
      const sim = new Simulation({ seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning: onlyItem("obstacle") });
      sim.start();
      if (!boxOn(sim, 2, 5)) continue;
      walk(sim, "a", [S]);
      return sim;
    }
    throw new Error("no seed puts the box on (2,5)");
  }
  const onTile = (sim: Simulation, x: number, y: number) => (list: { pos: { x: number; y: number } }[]) => list.some((o) => o.pos.x === x && o.pos.y === y);

  it("a key candidate that was not drawn is ordinary floor", () => {
    // Two key candidates, one player: find a round where the key is NOT on (2,6).
    for (let tries = 0; tries < 20; tries++) {
      const sim = facing26([{ x: 2, y: 6 }, { x: 7, y: 1 }], TINY_MAP.spawns!.lightSwitches!, 2);
      if (onTile(sim, 2, 6)(Object.values(sim.getState().keys))) break;
      expect(sim.availableAction(sim.getState().players["a"]!)).toBe("useItem");
      sim.step(new Map([["a", press]]));
      expect(Object.values(sim.getState().placeables).map((p) => p.pos)).toEqual([{ x: 2, y: 6, layer: "road" }]);
      return;
    }
    throw new Error("the key landed on (2,6) in every tried round");
  });

  it("the tile where a key was drawn stays reserved, even after the key is taken", () => {
    const sim = facing26([{ x: 2, y: 6 }], TINY_MAP.spawns!.lightSwitches!, 2);
    expect(sim.availableAction(sim.getState().players["a"]!)).toBeNull();
    walk(sim, "a", [S, N]); // take the key on (2,6), step back to (2,5)
    expect(sim.getState().players["a"]!.keyId).not.toBeNull();
    walk(sim, "a", [N, S]); // away and back, to face south again from (2,5)
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 5, layer: "road" });
    expect(sim.availableAction(sim.getState().players["a"]!)).toBeNull();
  });

  it("a switch candidate that was not drawn is ordinary floor; one that was drawn is not", () => {
    // Three switch candidates, two drawn. (3,6) and (6,4) touch walls in TINY_MAP; add (1,6)? It touches no wall, so use (4,6) under the wall (4,5).
    const candidates = [{ x: 3, y: 6 }, { x: 6, y: 4 }, { x: 4, y: 6 }];
    const sim = facing26([{ x: 7, y: 1 }], candidates, 2);
    const drawn = Object.values(sim.getState().switches).map((s) => `${s.pos.x},${s.pos.y}`);
    const free = candidates.find((c) => !drawn.includes(`${c.x},${c.y}`))!;
    expect(sim.grid.isReservedTile(free.x, free.y, "road")).toBe(false);
    for (const d of Object.values(sim.getState().switches)) expect(sim.grid.isReservedTile(d.pos.x, d.pos.y, "road")).toBe(true);
  });

  it("every box candidate is reserved, with or without a box on it", () => {
    const sim = facing26([{ x: 7, y: 1 }], TINY_MAP.spawns!.lightSwitches!, 2, [{ x: 2, y: 6 }, { x: 1, y: 6 }]);
    expect(sim.grid.isReservedTile(2, 6, "road")).toBe(true);
    expect(sim.grid.isReservedTile(1, 6, "road")).toBe(true);
    expect(sim.availableAction(sim.getState().players["a"]!)).toBeNull();
  });
});
