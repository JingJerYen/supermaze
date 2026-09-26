import { describe, expect, it } from "vitest";
import type { LobbyPlayer } from "@supermaze/protocol";
import { canSwitchTeam, makeRoomCode, shouldCountDown, startBlocker, teamForNewPlayer } from "../src/lobbyLogic.js";

const rules = { minPlayers: 2, maxPlayers: 6, maxTeamSizeDifference: 1 };
const p = (id: string, teamId: string, ready = true, connected = true): LobbyPlayer => ({ id, name: id, teamId, ready, connected });

describe("team assignment", () => {
  it("fills the smaller team, ties go to A", () => {
    expect(teamForNewPlayer([])).toBe("A");
    expect(teamForNewPlayer([p("1", "A")])).toBe("B");
    expect(teamForNewPlayer([p("1", "A"), p("2", "B")])).toBe("A");
    expect(teamForNewPlayer([p("1", "A"), p("2", "B"), p("3", "A")])).toBe("B");
  });

  it("allows a switch only while the size difference stays within one", () => {
    const players = [p("1", "A"), p("2", "A"), p("3", "B")];
    expect(canSwitchTeam(players, "3", rules)).toBe(false); // would be 3v0
    expect(canSwitchTeam(players, "1", rules)).toBe(true); // 1v2
    expect(canSwitchTeam([p("1", "A"), p("2", "B")], "1", rules)).toBe(false); // 0v2
  });
});

describe("start conditions", () => {
  it("needs the minimum, balance and (when required) everyone ready", () => {
    expect(startBlocker([p("1", "A")], rules, true)).toMatch(/至少/);
    expect(startBlocker([p("1", "A"), p("2", "A"), p("3", "A")], rules, true)).toMatch(/人數差/);
    expect(startBlocker([p("1", "A"), p("2", "B", false)], rules, true)).toMatch(/沒準備/);
    expect(startBlocker([p("1", "A"), p("2", "B", false)], rules, false)).toBeNull();
    expect(startBlocker([p("1", "A"), p("2", "B")], rules, true)).toBeNull();
  });

  it("ignores disconnected players when counting", () => {
    expect(startBlocker([p("1", "A"), p("2", "B", true, false)], rules, true)).toMatch(/至少/);
  });

  it("quick rooms count down when full even if not everyone is ready", () => {
    const full = ["1", "2", "3", "4", "5", "6"].map((id, i) => p(id, i % 2 ? "B" : "A", false));
    expect(shouldCountDown(full, rules, "quick")).toBe(true);
    expect(shouldCountDown(full, rules, "private")).toBe(false);
    expect(shouldCountDown([p("1", "A"), p("2", "B")], rules, "quick")).toBe(true);
    expect(shouldCountDown([p("1", "A"), p("2", "B", false)], rules, "quick")).toBe(false);
  });
});

describe("room codes", () => {
  it("are four unambiguous characters", () => {
    const code = makeRoomCode(() => 0.999);
    expect(code).toHaveLength(4);
    expect(code).not.toMatch(/[0OI1]/);
  });
});
