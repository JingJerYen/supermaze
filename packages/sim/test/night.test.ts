import { describe, expect, it } from "vitest";
import { CpuController } from "../src/cpu/controller.js";
import { tileKey, ALL_DIRS } from "../src/map/grid.js";
import type { MapData, TilePos } from "../src/map/types.js";
import { createMover } from "../src/movement.js";
import { NightSimulation } from "../src/night/nightSimulation.js";
import { farthestTile, stepsFrom } from "../src/night/spread.js";
import type { PlayerInput, PlayerState, SimulationState } from "../src/simulation.js";
import { NO_FREEZE } from "./fixtures.js";

/** Open lattice round a one-tile tower: loops everywhere, like the maps the mode is played on. */
const MAP: MapData = {
  id: "night-lattice",
  name: "night lattice",
  supportedParticipants: [1],
  lightSwitchCount: 2,
  timeLimitSec: 180,
  rows: [
    "XXXXXXXXXXXXXXX",
    "X.............X",
    "X.#.#.#.#.#.#.X",
    "X.............X",
    "X.#.#.#.#.#.#.X",
    "X......T......X",
    "X.#.#.#.#.#.#.X",
    "X.............X",
    "X.#.#.#.#.#.#.X",
    "X.............X",
    "XXXXXXXXXXXXXXX",
  ],
  spawns: {
    keys: [{ x: 13, y: 1, layer: "road" }, { x: 1, y: 9, layer: "road" }],
    itemBoxes: [{ x: 1, y: 1, layer: "road" }, { x: 13, y: 9, layer: "road" }, { x: 5, y: 1, layer: "road" }, { x: 9, y: 9, layer: "road" }],
    // Each touches a wall; (2,1) is the farthest from the tower's south door.
    lightSwitches: [{ x: 6, y: 7, layer: "road" }, { x: 2, y: 1, layer: "road" }, { x: 12, y: 9, layer: "road" }],
  },
};
const ME = "me";

/** Lets a test put the round into the exact situation it needs. */
class TestNight extends NightSimulation {
  patch(f: (s: SimulationState) => SimulationState): void {
    this.state = f(this.state);
  }
}

function night(seed = 3): TestNight {
  // The lattice is small: ghosts start 8 steps out instead of the default.
  const tuning = { ...NO_FREEZE, night: { ...NO_FREEZE.night, ghostMinStartSteps: 8 } };
  const sim = new TestNight({ seed, map: MAP, player: { id: ME, teamId: ME, controller: "human" }, tuning });
  sim.start();
  return sim;
}

function setPlayer(sim: TestNight, id: string, f: (p: PlayerState) => PlayerState): void {
  sim.patch((s) => ({ ...s, players: { ...s.players, [id]: f(s.players[id] as PlayerState) } }));
}

const at = (tile: TilePos, facing = { dx: 0, dy: 1 }) => createMover(tile, facing);
const ghosts = (sim: NightSimulation) => Object.values(sim.getState().players).filter((p) => p.monster);

describe("night parade (CLAUDE.md section 4.4)", () => {
  it("starts dark with eight ghosts far out, one key, one far switch and three lives", () => {
    const sim = night();
    const s = sim.getState();
    expect(s.lightsOn).toBe(false);
    expect(ghosts(sim)).toHaveLength(sim.tuning.night.ghostCount);
    expect(Object.keys(s.keys)).toHaveLength(1);
    expect(s.players[ME]!.lives).toBe(sim.tuning.night.lives);
    const switches = Object.values(s.switches);
    expect(switches).toHaveLength(1);
    expect(switches[0]!.pos).toEqual({ x: 2, y: 1, layer: "road" });
    expect(farthestTile(sim.grid, sim.grid.spawnTiles()[0]!, MAP.spawns!.lightSwitches!)).toEqual({ x: 2, y: 1, layer: "road" });
    const steps = stepsFrom(sim.grid, s.players[ME]!.mover.from);
    for (const g of ghosts(sim)) {
      expect(steps.get(tileKey(g.mover.from.x, g.mover.from.y, g.mover.from.layer))!.steps).toBeGreaterThanOrEqual(sim.tuning.night.ghostMinStartSteps);
      expect(sim.isGhost(g)).toBe(true);
    }
    expect(sim.isGhost(s.players[ME]!)).toBe(false);
    expect(sim.tuning.itemBoxes.weights.teleportNode).toBe(0);
    expect(s.endsAtTick - s.startTick).toBe(sim.tuning.night.timeLimitSec * sim.tuning.tickRate);
  });

  it("opens the door to the key only once every ghost is gone", () => {
    const sim = night();
    const door = sim.grid.doorTiles()[0]!;
    const facing = sim.grid.doorDir(door.x, door.y)!;
    const keyId = Object.keys(sim.getState().keys)[0]!;
    sim.patch((s) => ({ ...s, keys: { ...s.keys, [keyId]: { ...s.keys[keyId]!, ownerId: ME } } }));
    setPlayer(sim, ME, (p) => ({ ...p, keyId, mover: at(door, facing) }));
    expect(sim.availableAction(sim.getState().players[ME]!)).toBeNull();
    sim.patch((s) => ({ ...s, players: { [ME]: s.players[ME]! } }));
    expect(sim.availableAction(sim.getState().players[ME]!)).toBe("climb");
    const events = sim.step(new Map([[ME, { moveX: 0, moveY: 0, action: true }]]));
    expect(events).toContainEqual(expect.objectContaining({ type: "roundEnded", reason: "night:cleared" }));
  });

  it("a trap banishes the ghost that walks onto it and pays whoever set it", () => {
    const sim = night();
    const g = ghosts(sim)[0]!;
    const dir = ALL_DIRS.find((d) => sim.grid.tryMove(g.mover.from, d))!;
    const trapTile = sim.grid.tryMove(g.mover.from, dir)!;
    sim.patch((s) => ({
      ...s,
      placeables: { t: { id: "t", kind: "trap", pos: trapTile, dir, ownerId: ME, expiresAtTick: 1e9, permanent: false } },
    }));
    const push: PlayerInput = { moveX: dir.dx, moveY: dir.dy };
    const events = [];
    for (let i = 0; i < 40 && sim.getState().players[g.id]; i++) events.push(...sim.step(new Map([[g.id, push]])));
    expect(sim.getState().players[g.id]).toBeUndefined();
    expect(events).toContainEqual(expect.objectContaining({ type: "ghostBanished", ghostId: g.id, by: "trap", playerId: ME }));
    expect(sim.getState().players[ME]!.score).toBe(sim.tuning.scoring.trapCatch);
    expect(ghosts(sim)).toHaveLength(sim.tuning.night.ghostCount - 1);
  });

  it("turning the lights on knocks every ghost down for a while, harmless until it is up", () => {
    const sim = night();
    const sw = Object.values(sim.getState().switches)[0]!;
    setPlayer(sim, ME, (p) => ({ ...p, mover: at(sw.pos) }));
    const events = sim.step(new Map([[ME, { moveX: 0, moveY: 0, action: true }]]));
    const s = sim.getState();
    expect(s.lightsOn).toBe(true);
    const stun = events.find((e) => e.type === "ghostsStunned");
    expect(stun).toBeDefined();
    const until = s.tick + sim.tuning.night.lightStunSec * sim.tuning.tickRate;
    expect(ghosts(sim)).toHaveLength(sim.tuning.night.ghostCount);
    for (const g of ghosts(sim)) {
      expect(g.frozenBy).toBe("light");
      expect(g.frozenUntilTick).toBe(until);
    }
    // A downed ghost lying right on the player catches nobody.
    const g = ghosts(sim)[0]!;
    setPlayer(sim, g.id, (p) => ({ ...p, mover: at(sim.getState().players[ME]!.mover.from) }));
    let caught = 0;
    while (sim.getState().tick < until - 1) caught += sim.step(new Map()).filter((e) => e.type === "playerCaught").length;
    expect(caught).toBe(0);
    // Back up: the same ghost catches at once.
    for (let i = 0; i < 3; i++) caught += sim.step(new Map()).filter((e) => e.type === "playerCaught").length;
    expect(caught).toBe(1);
  });

  it("each catch costs a life and the last one ends the round", () => {
    const sim = night();
    const g = ghosts(sim)[0]!;
    setPlayer(sim, g.id, (p) => ({ ...p, mover: at(sim.getState().players[ME]!.mover.from) }));
    let caught = 0;
    for (let i = 0; i < 20000 && sim.getState().status === "running"; i++) {
      caught += sim.step(new Map()).filter((e) => e.type === "playerCaught").length;
    }
    expect(caught).toBe(sim.tuning.night.lives);
    expect(sim.getState().players[ME]!.lives).toBe(0);
    expect(sim.getState().result?.reason).toBe("night:caught");
    // No keys to steal: the ghost never takes one.
    expect(sim.getState().players[g.id]!.keyId).toBeNull();
  });

  it("replays the same with CPU ghosts", () => {
    const runOnce = () => {
      const sim = night(11);
      const cpu = new CpuController(sim, 12);
      for (let i = 0; i < 600; i++) sim.step(cpu.inputs());
      return JSON.stringify(sim.getState());
    };
    expect(runOnce()).toBe(runOnce());
  });
});
