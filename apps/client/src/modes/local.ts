import { DEFAULT_TUNING, Simulation, type MapData, type SimulationState } from "@supermaze/sim";
import { formatSeconds } from "./roundHud.js";
import { switchTileSet, type GameMode } from "./mode.js";

/** Single-player: the simulation runs inside the page. Same code the server runs. */
export function createLocalMode(map: MapData, options: { players?: number; seed?: number; name?: string } = {}): GameMode {
  const id = "local";
  // Extra participants are idle CPUs (no behaviour yet); they only make the round
  // spawn as many keys and boxes as a real match with that many players would.
  const players = Math.max(1, Math.min(options.players ?? 1, DEFAULT_TUNING.round.maxParticipants));
  const idle = Array.from({ length: players - 1 }, (_, i) => ({
    id: `cpu${i + 1}`,
    teamId: i % 2 === 0 ? "t2" : "t1",
    controller: "cpu" as const,
    name: `CPU ${i + 1}`,
  }));
  const sim = new Simulation({
    seed: options.seed ?? 1,
    map,
    participants: [{ id, teamId: "t1", controller: "human", name: options.name ?? "你" }, ...idle],
  });
  sim.start();
  let prev: SimulationState = sim.getState();

  return {
    label: "local",
    grid: sim.grid,
    theme: map.theme,
    plazaRadius: map.plazaRadius ?? 0,
    switchTiles: switchTileSet(map),
    tickRate: DEFAULT_TUNING.tickRate,
    localPlayerId: () => id,
    tick(input) {
      prev = sim.getState();
      sim.step(new Map([[id, input]]));
    },
    sample(_now, alpha) {
      return { from: prev, to: sim.getState(), alpha };
    },
    hud: () => {
      const st = sim.getState();
      const me = st.players[id];
      return {
        status: st.status,
        time: formatSeconds(sim.remainingSec()),
        layer: me?.mover.from.layer ?? "-",
        key: me?.keyId ? "yes" : "no",
        score: me?.score ?? 0,
        lights: st.lightsOn ? "on" : "OFF",
        ghost: `${st.ghost.phase} ${st.ghost.teamId ?? "-"} ${Math.max(0, st.ghost.phaseEndsAtTick - st.tick)}t`,
        items: me ? `${me.items.length}/${DEFAULT_TUNING.inventory.capacity} ${me.items.join(",")}` : "-",
        action: (me && sim.availableAction(me)) ?? "-",
      };
    },
    debug: (cmd) => {
      if (cmd === "ghost") sim.debugForceGhost();
    },
    results: () => ({
      endsAt: null,
      buttons: [
        { label: "再玩一次", primary: true, run: () => location.reload() },
        { label: "回首頁", run: () => (location.href = location.pathname) },
      ],
    }),
  };
}
