import { describe, expect, it } from "vitest";
import { pickMap, playableMaps } from "../src/map/pool.js";
import type { MapData } from "../src/map/types.js";
import { LATTICE_MAP } from "./fixtures.js";

const named = (id: string, supportedParticipants: number[], extra: Partial<MapData> = {}): MapData => ({ ...LATTICE_MAP, id, supportedParticipants, ...extra });

describe("playableMaps", () => {
  it("keeps valid maps in id order and reports the others", () => {
    const broken = named("broken", [2], { rows: ["XXX", "X.X", "XXX"] }); // no tower
    const heard: string[] = [];
    const pool = playableMaps([named("b", [2]), broken, named("a", [2])], (m, problems) => heard.push(`${m.id}:${problems.length > 0}`));
    expect(pool.map((m) => m.id)).toEqual(["a", "b"]);
    expect(heard).toEqual(["broken:true"]);
  });
});

describe("pickMap", () => {
  const maps = [named("two", [2]), named("small", [2, 3, 4]), named("big", [4, 5, 6])];

  it("only draws maps that list the participant count", () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(["two", "small"]).toContain(pickMap(maps, 2, seed)!.id);
      expect(pickMap(maps, 3, seed)!.id).toBe("small");
      expect(["small", "big"]).toContain(pickMap(maps, 4, seed)!.id);
      expect(pickMap(maps, 6, seed)!.id).toBe("big");
    }
  });

  it("returns null when nothing supports that many", () => {
    expect(pickMap(maps, 1, 5)).toBeNull();
    expect(pickMap(maps, 7, 5)).toBeNull();
    expect(pickMap([], 2, 5)).toBeNull();
  });

  it("is repeatable for a seed, independent of list order, and spreads over the candidates", () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 400; seed++) {
      const id = pickMap(maps, 2, seed)!.id;
      expect(pickMap([...maps].reverse(), 2, seed)!.id).toBe(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get("two")).toBeGreaterThan(120);
    expect(counts.get("small")).toBeGreaterThan(120);
  });
});

describe("map modes", () => {
  const night: MapData = { ...LATTICE_MAP, id: "night", modes: ["night"] };
  const both: MapData = { ...LATTICE_MAP, id: "both", modes: ["race", "night"] };

  it("keeps night maps out of the race pool and race maps out of the night pool", () => {
    expect(playableMaps([LATTICE_MAP, night, both]).map((m) => m.id)).toEqual(["both", "lattice"]);
    expect(playableMaps([LATTICE_MAP, night, both], undefined, undefined, "night").map((m) => m.id)).toEqual(["both", "night"]);
  });
});
