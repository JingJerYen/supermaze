import { describe, expect, it } from "vitest";
import { Simulation, type MapData } from "@supermaze/sim";
import { minimapDots } from "../src/hud/minimapModel.js";
import { RULE_SCENES } from "../src/rules/scenes.js";
import { CLIENT_TUNING } from "../src/tuning.js";

const map: MapData = { ...RULE_SCENES[0]!.map, spawns: { keys: [1, 3, 5, 7].map((x) => ({ x, y: 1, layer: "road" as const })), itemBoxes: [], lightSwitches: [] } };
const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

function stateOf(teamMode: "teams" | "solo", teams: Record<string, string>) {
  const tuning = RULE_SCENES[0]!.tuning;
  const sim = new Simulation({
    seed: 1,
    map,
    teamMode,
    tuning: tuning((new Simulation({ seed: 1, map, participants: [] })).tuning),
    participants: Object.entries(teams).map(([id, teamId]) => ({ id, teamId, controller: "human" as const })),
  });
  sim.start();
  return sim.getState();
}

describe("minimapDots", () => {
  it("shows every player, you last so your dot is on top", () => {
    const dots = minimapDots(stateOf("teams", { a1: "A", b1: "B", a2: "A", b2: "B" }), "a2");
    expect(dots.map((d) => d.id)).toEqual(["a1", "b1", "b2", "a2"]);
    expect(dots.filter((d) => d.self).map((d) => d.id)).toEqual(["a2"]);
  });

  it("two teams: one colour per team, yours included", () => {
    const dots = minimapDots(stateOf("teams", { a1: "A", b1: "B", a2: "A", b2: "B" }), "a1");
    const colour = (id: string) => dots.find((d) => d.id === id)!.color;
    expect(colour("a1")).toBe(colour("a2"));
    expect(colour("b1")).toBe(colour("b2"));
    expect(colour("a1")).not.toBe(colour("b1"));
  });

  it("everyone for themselves: you in one colour, all the others in another", () => {
    const dots = minimapDots(stateOf("solo", { p1: "p1", p2: "p2", p3: "p3" }), "p2");
    const colour = (id: string) => dots.find((d) => d.id === id)!.color;
    expect(colour("p2")).toBe(css(CLIENT_TUNING.minimap.soloSelfColor));
    expect(colour("p1")).toBe(css(CLIENT_TUNING.minimap.soloOtherColor));
    expect(colour("p3")).toBe(css(CLIENT_TUNING.minimap.soloOtherColor));
  });

  it("in the dark only your own dot is left, for players in the maze and on the tower alike", () => {
    const lit = stateOf("teams", { a1: "A", b1: "B", a2: "A", b2: "B" });
    const dark = { ...lit, lightsOn: false, players: { ...lit.players, b1: { ...lit.players["b1"]!, phase: "tower" as const } } };
    expect(minimapDots(dark, "a1").map((d) => d.id)).toEqual(["a1"]);
    expect(minimapDots(dark, "b1").map((d) => d.id)).toEqual(["b1"]);
    expect(minimapDots({ ...dark, lightsOn: true }, "a1")).toHaveLength(4);
  });

  it("is the same list for a player on the tower and one in the maze", () => {
    const state = stateOf("solo", { p1: "p1", p2: "p2" });
    const raised = { ...state, players: { ...state.players, p1: { ...state.players["p1"]!, phase: "tower" as const } } };
    const seenFromTower = minimapDots(raised, "p1");
    const seenFromMaze = minimapDots(raised, "p2");
    expect(seenFromTower.map((d) => [d.id, d.x, d.y, d.onTower]).sort()).toEqual(seenFromMaze.map((d) => [d.id, d.x, d.y, d.onTower]).sort());
    expect(seenFromMaze.find((d) => d.id === "p1")!.onTower).toBe(true);
  });
});
