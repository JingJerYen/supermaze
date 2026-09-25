import type { SnapshotMessage, WelcomeMessage } from "@supermaze/protocol";
import { MapGrid, type MapData } from "@supermaze/sim";
import { Connection } from "../net/connection.js";
import { SnapshotBuffer } from "../net/snapshots.js";
import type { GameMode } from "./mode.js";

/**
 * Multiplayer: the server owns the simulation, the page sends intents and
 * interpolates between snapshots. Connecting happens in the background so the
 * map is visible immediately and a failed connection is reported on screen
 * instead of leaving a blank page. Phase 0 assumes the client already has the
 * same map file the server loaded; map delivery is a phase-2 topic.
 */
export function createOnlineMode(map: MapData, endpoint: string): GameMode {
  const grid = MapGrid.fromMapData(map);
  let welcome: WelcomeMessage | null = null;
  let buffer = new SnapshotBuffer(50);
  let rttMs = 0;
  let status = "connecting";
  let banner: string | null = `連線中 ${endpoint} ...`;

  const conn = new Connection(endpoint, {
    onWelcome(m) {
      welcome = m;
      buffer = new SnapshotBuffer(1000 / m.tickRate);
      status = "online";
      banner = null;
    },
    onSnapshot(m: SnapshotMessage, at) {
      buffer.push(m, at);
    },
    onPong(m, at) {
      rttMs = at - m.t;
    },
    onLeave(code) {
      status = `left (${code})`;
      banner = `已離開房間（代碼 ${code}）。重新整理頁面可重連。`;
    },
  });

  conn.connect().catch((e: unknown) => {
    status = "error";
    banner = `無法連線到 ${endpoint}\n請先在專案目錄執行 npm run dev:server\n(${(e as Error).message ?? String(e)})`;
  });
  setInterval(() => conn.ping(), 1000);

  return {
    label: "online",
    grid,
    tickRate: 20,
    localPlayerId: () => welcome?.playerId ?? conn.sessionId,
    tick(input) {
      if (status === "online") conn.sendInput(input);
    },
    sample(now) {
      const s = buffer.sample(now);
      return s ? { from: s.from.players, to: s.to.players, alpha: s.alpha } : null;
    },
    hud: () => ({
      status,
      tick: buffer.latest()?.tick ?? 0,
      players: Object.keys(buffer.latest()?.players ?? {}).length,
      rtt: `${rttMs.toFixed(0)}ms`,
    }),
    banner: () => banner,
  };
}
