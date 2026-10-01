import type { lobby as zh } from "../zh-Hant/lobby.js";

export const lobby: Record<keyof typeof zh, string> = {
  "lobby.notice.needPlayers": "Needs at least {n} players",
  "lobby.notice.tooManyPlayers": "At most {n} players",
  "lobby.notice.teamsUneven": "Both teams must be the same size",
  "lobby.notice.notReady": "Someone isn't ready yet",
  "lobby.notice.quickTimeout": "No one else has joined for a minute. Try again later.",
  "lobby.notice.noMap": "No map takes {n} players",
};
