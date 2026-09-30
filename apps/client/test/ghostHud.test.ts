import { describe, expect, it } from "vitest";
import { Simulation, type MapData } from "@supermaze/sim";
import { buildHudModel } from "../src/hud/model.js";
import { useTeams } from "../src/render/teamColors.js";
import { RULE_SCENES } from "../src/rules/scenes.js";

const map: MapData = { ...RULE_SCENES[0]!.map, spawns: { keys: [1, 3, 5, 7].map((x) => ({ x, y: 1, layer: "road" as const })), itemBoxes: [], lightSwitches: [] } };

/** A running match with a ghost warning up, as the HUD sees it (Match.render announces the teams first). */
function hud(teamMode: "teams" | "solo", players: [string, string][], meId: string) {
  const sim = new Simulation({
    seed: 1,
    map,
    teamMode,
    // The rules scenes' quiet tuning: no item boxes, which this small map has no room for.
    tuning: RULE_SCENES[0]!.tuning(new Simulation({ seed: 1, map, participants: [] }).tuning),
    participants: players.map(([id, teamId]) => ({ id, teamId, name: id, controller: "human" as const })),
  });
  sim.start();
  sim.debugForceGhost(3);
  const state = sim.getState();
  useTeams(Object.values(state.players).map((p) => p.teamId));
  return buildHudModel(state, meId, sim.grid, sim.tuning.tickRate, sim.tuning.inventory.capacity);
}

const labels = (m: ReturnType<typeof hud>) => Object.fromEntries([m.myTeam!, ...m.otherTeams].map((t) => [t.players[0]!.name, t.label]));

describe("team letters follow the lobby's team ids", () => {
  it("team A is 'A 隊' even when the first player to join is on team B", () => {
    const m = hud("teams", [["alice", "B"], ["bob", "A"]], "alice");
    expect(labels(m)).toEqual({ alice: "B 隊", bob: "A 隊" });
    // The first ghost team is A (sorted ids), and the warning names it so.
    expect(m.ghost.teamLabel).toBe("A 隊");
  });

  it("a solo match played earlier on the page does not shift the letters", () => {
    hud("solo", [["x", "x"], ["y", "y"], ["z", "z"]], "x");
    const m = hud("teams", [["alice", "A"], ["bob", "B"]], "alice");
    expect(labels(m)).toEqual({ alice: "A 隊", bob: "B 隊" });
  });
});

describe("ghost notice", () => {
  it("counts the real warning down and names the team", () => {
    const m = hud("teams", [["alice", "A"], ["bob", "B"]], "bob");
    expect(m.ghost).toMatchObject({ phase: "warning", teamLabel: "A 隊", secondsLeft: 3, iAmGhost: false, myTeamIsGhost: false });
  });

  it("names you as 'you' in solo and marks your own team in teams", () => {
    // "cpu" sorts before "me", so the cpu is the first ghost; from its side the warning says 你.
    expect(hud("solo", [["me", "me"], ["cpu", "cpu"]], "cpu").ghost.warningSubject).toBe("你");
    expect(hud("solo", [["me", "me"], ["cpu", "cpu"]], "me").ghost.warningSubject).toBe("cpu");
    expect(hud("teams", [["alice", "A"], ["bob", "B"]], "alice").ghost.warningSubject).toBe("A 隊（我方）");
    expect(hud("teams", [["alice", "A"], ["bob", "B"]], "bob").ghost.warningSubject).toBe("A 隊");
  });

  it("disappears once the round is over, even mid-warning", () => {
    const sim = new Simulation({
      seed: 1,
      map,
      teamMode: "teams",
      tuning: RULE_SCENES[0]!.tuning(new Simulation({ seed: 1, map, participants: [] }).tuning),
      participants: [["alice", "A"], ["bob", "B"]].map(([id, teamId]) => ({ id: id!, teamId: teamId!, controller: "human" as const })),
    });
    sim.start();
    sim.debugForceGhost(3);
    const finished = { ...sim.getState(), status: "finished" as const };
    expect(finished.ghost.phase).toBe("warning");
    const m = buildHudModel(finished, "alice", sim.grid, sim.tuning.tickRate, sim.tuning.inventory.capacity);
    expect(m.ghost.phase).toBe("idle");
  });
});

describe("your own freeze", () => {
  it("counts down for the frozen player only, with the cause", () => {
    const sim = new Simulation({
      seed: 1,
      map,
      teamMode: "teams",
      tuning: RULE_SCENES[0]!.tuning(new Simulation({ seed: 1, map, participants: [] }).tuning),
      participants: [["alice", "A"], ["bob", "B"]].map(([id, teamId]) => ({ id: id!, teamId: teamId!, controller: "human" as const })),
    });
    sim.start();
    const st = sim.getState();
    const rate = sim.tuning.tickRate;
    const alice = { ...st.players["alice"]!, frozenUntilTick: st.tick + 7 * rate, frozenBy: "trap" as const };
    const frozen = { ...st, players: { ...st.players, alice } };
    const model = (me: string) => buildHudModel(frozen, me, sim.grid, rate, sim.tuning.inventory.capacity);
    expect(model("alice").myFreeze).toEqual({ sec: 7, by: "trap" });
    expect(model("bob").myFreeze).toBeNull();
  });
});
