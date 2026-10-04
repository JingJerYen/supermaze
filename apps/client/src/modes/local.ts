import { CpuController, DEFAULT_TUNING, NightSimulation, Simulation, withCpuDifficulty, type CpuDifficulty, type MapData, type SimEvent, type SimulationState, type SkillKind, type Tuning } from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { t } from "../i18n/index.js";
import { formatSeconds } from "./roundHud.js";
import { switchTileSet, type GameMode } from "./mode.js";
import { cpuCast } from "../characterNames.js";
import { characters } from "../render/characters.js";

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
  /** One-shot skill for you this round (tower run; CPUs never get one). */
  skill?: SkillKind | null;
  /** A second one (tower run, full version). */
  skill2?: SkillKind | null;
  /** Your character model (file name in public/models/characters); by player id when omitted. */
  character?: string | null;
  /** End the round the moment you climb instead of waiting for the CPUs (tower run). */
  endWhenYouClimb?: boolean;
  /** Start with the lights off (tower run special floor). */
  startDark?: boolean;
  /** Every ghost event turns all the CPUs into ghosts at once, hunting you (tower run special floor). */
  ghostPack?: boolean;
  /** A night parade instead of a race (section 4.4): `players` is ignored, the ghosts come with it. */
  night?: { ghostName: string };
  /** Called after every tick with the states either side of it and its events (the tower run's achievements). */
  onStep?: (prev: SimulationState, next: SimulationState, events: readonly SimEvent[]) => void;
  /** Big toasts to show now; see GameMode.notices. */
  notices?: () => string[];
  /** Called once, on the tick the round finishes. */
  onFinish?: (state: SimulationState) => void;
  /** Replaces the default result-screen buttons. */
  results?: () => ResultsActions;
  /** Small line under the clock (tower run: floor, pass rank, total). */
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
  // Each CPU is one of the characters, under its default name; never the one you are drawn as.
  const cast = cpuCast(players - 1, options.seed ?? 1, [characters.resolve(id, options.character)]);
  const idle = cast.map((c, i) => ({
    id: `cpu${i + 1}`,
    teamId: `cpu${i + 1}`,
    controller: "cpu" as const,
    name: c.name,
    character: c.character,
  }));
  const me = { id, teamId: id, controller: "human" as const, name: options.name ?? t("hud.you"), skill: options.skill ?? null, skill2: options.skill2 ?? null, character: options.character ?? null };
  const sim = options.night
    ? new NightSimulation({ seed: options.seed ?? 1, map, player: me, ghostName: options.night.ghostName, ...(options.tuning ? { tuning: options.tuning } : {}) })
    : new Simulation({
        seed: options.seed ?? 1,
        map,
        teamMode: "solo",
        ...(options.endWhenYouClimb ? { endWhenClimbed: id } : {}),
        ...(options.startDark ? { startDark: true } : {}),
        ...(options.ghostPack ? { ghostPack: id } : {}),
        tuning: options.tuning ?? withCpuDifficulty(options.difficulty ?? "easy"),
        participants: [me, ...idle],
      });
  sim.start();
  const cpu = new CpuController(sim, (options.seed ?? 1) + 1);
  let prev: SimulationState = sim.getState();
  let finished = false;

  return {
    label: "local",
    grid: sim.grid,
    theme: map.theme,
    difficulty: map.difficulty,
    plazaRadius: map.plazaRadius ?? 0,
    switchTiles: switchTileSet(map),
    tickRate: DEFAULT_TUNING.tickRate,
    localPlayerId: () => id,
    tick(input) {
      prev = sim.getState();
      const inputs = cpu.inputs();
      inputs.set(id, input);
      const events = sim.step(inputs);
      options.onStep?.(prev, sim.getState(), events);
      if (!finished && sim.getState().status === "finished") {
        finished = true;
        options.onFinish?.(sim.getState());
      }
    },
    caption: () => options.caption?.() ?? null,
    notices: () => options.notices?.() ?? [],
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
        { label: t("hud.result.again"), primary: true, run: options.onAgain ?? (() => location.reload()) },
        { label: t("hud.result.home"), back: true, run: options.onHome ?? (() => (location.href = location.pathname)) },
      ],
    })),
  };
}
