import { Client } from "@colyseus/sdk";
import { Bot } from "./bot.js";
import { fmt, summarize } from "./stats.js";

/**
 * Phase-0 network spike (CLAUDE.md section 18):
 *   1. N bots join one room and random-walk for a while; report snapshot cadence,
 *      approximate snapshot size and ping RTT as seen by every bot.
 *   2. One bot drops its socket; the server must switch it to CPU control while
 *      keeping the player, then hand control back on reconnect.
 * Exit code is non-zero if any check fails.
 */
const ENDPOINT = process.env["ENDPOINT"] ?? "ws://localhost:2567";
const BOTS = Number(process.env["BOTS"] ?? 6); // room max is 6 participants
const RUN_MS = Number(process.env["RUN_MS"] ?? 15000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failures.push(label);
};

async function main(): Promise<void> {
  console.log(`connecting ${BOTS} bots to ${ENDPOINT}`);
  const bots = Array.from({ length: BOTS }, (_, i) => new Bot(`bot${i}`, new Client(ENDPOINT)));
  // A private room for this run: real players on the same server must not eat our seats.
  const roomId = await (bots[0] as Bot).create();
  const startedAt = Date.now();
  await sleep(300);
  const code = bots[0]?.lobby?.code ?? null;
  check(!!code && code.length === 4, `private room has a 4-letter code (${code})`);

  // Second bot joins by code (metadata filter), the rest by room id.
  if (bots[1] && code) await bots[1].joinByCode(code);
  await Promise.all(bots.slice(2).map((b) => b.join(roomId)));
  await sleep(300);

  check(bots.every((b) => b.welcome), "every bot received welcome");
  check(new Set(bots.map((b) => b.room?.roomId)).size === 1, "all bots landed in the same room");
  const lobby = bots[0]?.lobby;
  const sizes = { A: 0, B: 0 };
  for (const p of lobby?.players ?? []) sizes[p.teamId as "A" | "B"]++;
  check(!!lobby && lobby.players.length === BOTS, `lobby lists all ${BOTS} players`);
  check(Math.abs(sizes.A - sizes.B) <= 1, `teams auto-balanced (${sizes.A} v ${sizes.B})`);
  check(lobby?.phase === "lobby", "no countdown before everyone is ready");

  for (const b of bots) b.ready();
  await sleep(400);
  check(bots[0]?.lobby?.phase === "countdown", "all ready -> countdown");
  const countdownMs = (bots[0]?.lobby?.countdownEndsAt ?? Date.now()) - Date.now();
  console.log(`waiting ${Math.max(0, countdownMs)} ms for the countdown ...`);
  await sleep(Math.max(0, countdownMs) + 800);
  check(bots.every((b) => b.matchStarted && b.state), "match started and every bot has a full state");

  const tickRate = bots[0]?.matchStarted?.tickRate ?? 20;
  for (const b of bots) b.start(tickRate);
  console.log(`random-walking for ${RUN_MS} ms at ${tickRate} Hz ...`);
  await sleep(RUN_MS);

  const gaps = summarize(bots.flatMap((b) => b.snapshotGapsMs));
  const bytes = summarize(bots.flatMap((b) => b.snapshotBytes));
  const rtt = summarize(bots.flatMap((b) => b.rttMs));
  console.log(`snapshot gap   ${fmt(gaps)}  (target ${(1000 / tickRate).toFixed(1)}ms)`);
  console.log(`snapshot size  ${fmt(bytes, "B")}  (JSON-equivalent, per-tick delta; full state ${bots[0]?.fullBytes ?? 0} B)`);
  console.log(`ping rtt       ${fmt(rtt)}`);
  const playersSeen = Object.keys(bots[0]?.state?.players ?? {}).length;
  check(playersSeen === BOTS, `snapshots contain all ${BOTS} players (saw ${playersSeen})`);
  check(gaps.p95 < (1000 / tickRate) * 2, "p95 snapshot gap under two tick intervals");
  check(rtt.p95 < 50, "p95 ping RTT under 50 ms on localhost");

  // --- scenario A: manual reconnection with the SDK's auto-retry disabled ---
  const observer = bots[1] as Bot;
  const victim = bots[0] as Bot;
  const victimId = victim.room?.sessionId as string;
  const token = victim.room?.reconnectionToken as string;
  const before = observer.state?.players[victimId];

  console.log(`[A] dropping ${victim.name} (${victimId}) without auto-reconnect ...`);
  await victim.dropConnection(false);
  await sleep(600);
  const dropped = observer.state?.players[victimId];
  check(!!dropped, "[A] dropped player still exists in the room");
  check(dropped?.controller === "cpu", "[A] dropped player switched to cpu control");
  check(!!dropped && !!before && dropped.teamId === before.teamId, "[A] team preserved while dropped");

  console.log(`[A] reconnecting ${victim.name} with its token ...`);
  await victim.reconnect(token);
  await sleep(600);
  const back = observer.state?.players[victimId];
  check(back?.controller === "human", "[A] reconnected player is human again");
  check(victim.room?.sessionId === victimId, "[A] reconnected client kept its session id");
  victim.snapshotsAdvanced();
  await sleep(300);
  check(victim.snapshotsAdvanced(), "[A] reconnected client receives snapshots again");

  // --- scenario B: transport drop with the SDK's auto-reconnect left on ---
  // The SDK refuses to auto-reconnect a room that has been joined for less than
  // `reconnection.minUptime` (5 s by default), so make sure we are past it.
  const auto = bots[2] as Bot;
  const autoId = auto.room?.sessionId as string;
  const minUptime = auto.room?.reconnection.minUptime ?? 5000;
  const joinedAgo = Date.now() - startedAt;
  if (joinedAgo < minUptime + 500) await sleep(minUptime + 500 - joinedAgo);
  console.log(`[B] dropping ${auto.name} (${autoId}) with auto-reconnect (room uptime ${(Date.now() - startedAt) / 1000}s, minUptime ${minUptime}ms) ...`);
  await auto.dropConnection(true);
  await sleep(2500);
  const autoBack = observer.state?.players[autoId];
  check(autoBack?.controller === "human", "[B] auto-reconnected player is human again");
  auto.snapshotsAdvanced();
  await sleep(300);
  check(auto.snapshotsAdvanced(), "[B] auto-reconnected client receives snapshots again");

  // Leaving on purpose mid-match: the player stays in the round under CPU control.
  const leaver = bots[BOTS - 1] as Bot;
  const leaverId = leaver.room?.sessionId as string;
  await leaver.leave();
  await sleep(600);
  check(observer.state?.players[leaverId]?.controller === "cpu", "consented leave mid-match hands the player to the CPU");
  check(observer.lobby?.players.find((p) => p.id === leaverId)?.connected === false, "lobby marks the leaver disconnected");

  // Best-effort cleanup; a leave() that never resolves must not hide the verdict.
  await Promise.race([Promise.all(bots.map((b) => b.leave().catch(() => undefined))), sleep(2000)]);
  console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
  process.exitCode = failures.length ? 1 : 0;
  // Let stdout flush, then stop the SDK's timers.
  setTimeout(() => process.exit(), 100);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  setTimeout(() => process.exit(), 100);
});
