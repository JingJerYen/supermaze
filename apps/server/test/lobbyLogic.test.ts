import { describe, expect, it } from "vitest";
import type { LobbyPlayer } from "@supermaze/protocol";
import { canSwitchTeam, makeRoomCode, rulesFor, shouldCountDown, startBlocker, teamForNewPlayer } from "../src/lobbyLogic.js";

const teams = rulesFor("private", "teams", 6);
const solo = rulesFor("private", "solo", 6);
const quick = rulesFor("quick", "solo", 6); // the requested mode is ignored: quick is always 1v1
const p = (id: string, teamId: string, ready = true, connected = true): LobbyPlayer => ({ id, name: id, teamId, ready, connected });

describe("rules per room kind", () => {
  it("quick match is two players in teams mode; private rooms take up to six in the host's mode", () => {
    expect(quick).toEqual({ minPlayers: 2, maxPlayers: 2, teamMode: "teams" });
    expect(teams).toEqual({ minPlayers: 2, maxPlayers: 6, teamMode: "teams" });
    expect(solo).toEqual({ minPlayers: 2, maxPlayers: 6, teamMode: "solo" });
  });
});

describe("team assignment", () => {
  it("fills the smaller team, ties go to A", () => {
    expect(teamForNewPlayer([])).toBe("A");
    expect(teamForNewPlayer([p("1", "A")])).toBe("B");
    expect(teamForNewPlayer([p("1", "A"), p("2", "B")])).toBe("A");
    expect(teamForNewPlayer([p("1", "A"), p("2", "B"), p("3", "A")])).toBe("B");
  });

  it("allows a switch while the other team has a free seat, in teams mode only", () => {
    const players = [p("1", "A"), p("2", "A"), p("3", "A"), p("4", "B")];
    expect(canSwitchTeam(players, "4", teams)).toBe(false); // A is full (3 of 3)
    expect(canSwitchTeam(players, "1", teams)).toBe(true);
    expect(canSwitchTeam(players, "1", solo)).toBe(false);
    expect(canSwitchTeam(players, "nobody", teams)).toBe(false);
  });
});

describe("start conditions", () => {
  it("teams mode needs equal teams; solo mode does not care", () => {
    const three = [p("1", "A"), p("2", "B"), p("3", "A")];
    expect(startBlocker(three, teams, true)).toMatch(/人數必須相同/);
    expect(startBlocker(three, solo, true)).toBeNull();
    expect(startBlocker([p("1", "A"), p("2", "A")], teams, true)).toMatch(/人數必須相同/);
    expect(startBlocker([p("1", "A"), p("2", "B"), p("3", "A"), p("4", "B")], teams, true)).toBeNull();
  });

  it("needs the minimum and (when required) everyone ready", () => {
    expect(startBlocker([p("1", "A")], teams, true)).toMatch(/至少/);
    expect(startBlocker([p("1", "A")], solo, true)).toMatch(/至少/);
    expect(startBlocker([p("1", "A"), p("2", "B", false)], teams, true)).toMatch(/沒準備/);
    expect(startBlocker([p("1", "A"), p("2", "B", false)], teams, false)).toBeNull();
  });

  it("ignores disconnected players when counting", () => {
    expect(startBlocker([p("1", "A"), p("2", "B", true, false)], teams, true)).toMatch(/至少/);
  });

  it("quick rooms count down as soon as both players are in, ready or not", () => {
    const pair = [p("1", "A", false), p("2", "B", false)];
    expect(shouldCountDown(pair, quick, "quick")).toBe(true);
    expect(shouldCountDown([p("1", "A", false)], quick, "quick")).toBe(false);
    expect(shouldCountDown(pair, teams, "private")).toBe(false);
    expect(shouldCountDown([p("1", "A"), p("2", "B")], teams, "private")).toBe(true);
  });
});

describe("room codes", () => {
  it("are four unambiguous characters", () => {
    const code = makeRoomCode(() => 0.999);
    expect(code).toHaveLength(4);
    expect(code).not.toMatch(/[0OI1]/);
  });
});
