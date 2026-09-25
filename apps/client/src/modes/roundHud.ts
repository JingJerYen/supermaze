import type { SimulationState } from "@supermaze/sim";

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const REASON_TEXT: Record<string, string> = {
  allClimbed: "全員登頂",
  "timeout:climbed": "時間到，登塔人數較多",
  "timeout:score": "時間到，登塔人數相同，總分較高",
  "timeout:earlier": "時間到，人數與分數相同，較早達成",
  "timeout:draw": "時間到，完全平手",
};

/** Centre-screen text at the end of a round, or null while it is still going. */
export function roundBanner(st: SimulationState): string | null {
  if (st.status !== "finished" || !st.result) return null;
  const r = st.result;
  const lines = [
    r.winnerTeamId ? `隊伍 ${r.winnerTeamId} 獲勝` : "沒有獲勝隊伍",
    REASON_TEXT[r.reason] ?? r.reason,
    "",
    ...Object.values(st.players)
      .sort((a, b) => (r.finalScores[b.id] ?? 0) - (r.finalScores[a.id] ?? 0))
      .map((p) => `${p.id}  隊 ${p.teamId}  ${p.phase === "tower" ? `第 ${(p.towerArrival ?? 0) + 1} 名` : "未登塔"}  ${r.finalScores[p.id] ?? 0} 分`),
  ];
  return lines.join("\n");
}
