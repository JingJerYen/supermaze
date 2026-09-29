import { CpuController, DEFAULT_TUNING, Simulation, withCpuDifficulty, type CpuDifficulty, type MapData, type SimulationState, type Tuning } from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { formatSeconds } from "./roundHud.js";
import { switchTileSet, type GameMode } from "./mode.js";

/**
 * Single-player: the simulation runs inside the page. Same code the server runs.
 * Always everyone for themselves (CLAUDE.md 2.1): you against 1 to 5 CPUs, no teams.
 */
export interface LocalOptions {
  /** Participants including you; the rest are CPUs. */
  players?: number;
  seed?: number;
  name?: string;
  /** CPU strength preset (tuning `cpu.difficulties`); easy when omitted. */
  difficulty?: CpuDifficulty;
  /** Full tuning for the round; wins over `difficulty` (the tower run sets each floor's CPU strength). */
  tuning?: Tuning;
  /** Called once, on the tick the round finishes. */
  onFinish?: (state: SimulationState) => void;
  /** Replaces the default result-screen buttons. */
  results?: () => ResultsActions;
  /** Small line under the clock (tower run: floor and hearts). */
  caption?: () => string | null;
  /** Result-screen actions; default to reloading the page and going to the site root. */
  onAgain?: () => void;
  onHome?: () => void;
}

export function createLocalMode(map: MapData, options: LocalOptions = {}): GameMode {
  const id = "local";
  // Extra participants are CPU opponents driven by the sim's CpuController (the
  // same one the server uses for dropped players).
  const players = Math.max(1, Math.min(options.players ?? 1, DEFAULT_TUNING.round.maxParticipants));
  const idle = Array.from({ length: players - 1 }, (_, i) => ({
    id: `cpu${i + 1}`,
    teamId: `cpu${i + 1}`,
    controller: "cpu" as const,
    name: `CPU ${i + 1}`,
  }));
  const sim = new Simulation({
    seed: options.seed ?? 1,
    map,
    teamMode: "solo",
    tuning: options.tuning ?? withCpuDifficulty(options.difficulty ?? "easy"),
    participants: [{ id, teamId: id, controller: "human", name: options.name ?? "你" }, ...idle],
  });
  sim.start();
  const cpu = new CpuController(sim, (options.seed ?? 1) + 1);
  let prev: SimulationState = sim.getState();
  let finished = false;

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
      const inputs = cpu.inputs();
      inputs.set(id, input);
      sim.step(inputs);
      if (!finished && sim.getState().status === "finished") {
        finished = true;
        options.onFinish?.(sim.getState());
      }
    },
    caption: () => options.caption?.() ?? null,
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
    exit: options.onHome ?? (() => (location.href = location.pathname)),
    debug: (cmd) => {
      if (cmd === "ghost") sim.debugForceGhost();
    },
    results: options.results ?? (() => ({
      endsAt: null,
      buttons: [
        { label: "再玩一次", primary: true, run: options.onAgain ?? (() => location.reload()) },
        { label: "回首頁", run: options.onHome ?? (() => (location.href = location.pathname)) },
      ],
    })),
  };
}
