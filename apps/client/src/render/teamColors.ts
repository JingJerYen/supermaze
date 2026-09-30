/** Stable colour per team id, shared by players and their teleport nodes. */
export const TEAM_COLORS = [0xffb347, 0x5ec8ff, 0x8bff7a, 0xff7ad9, 0xfff17a, 0xc79aff, 0xff8a5c, 0x7affd6];

const index = new Map<string, number>();
let seeded = "";

/**
 * Numbers the teams of the match on screen in sorted id order, so team A is
 * always the first colour and letter (as in the lobby), whoever joined first
 * and whatever was played before on this page, and every client agrees.
 * Called every frame with the current players' teams; cheap when unchanged.
 */
export function useTeams(teamIds: Iterable<string>): void {
  const ids = [...new Set(teamIds)].sort();
  const key = ids.join("\n");
  if (key === seeded) return;
  seeded = key;
  index.clear();
  ids.forEach((id, i) => index.set(id, i));
}

/** Index of a team for its colour and letter; a team the match has not announced gets the next free one. */
export function teamColorIndex(teamId: string): number {
  let i = index.get(teamId);
  if (i === undefined) {
    i = index.size;
    index.set(teamId, i);
  }
  return i;
}
