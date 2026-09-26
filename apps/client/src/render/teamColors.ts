/** Stable colour per team id, shared by players and their teleport nodes. */
export const TEAM_COLORS = [0xffb347, 0x5ec8ff, 0x8bff7a, 0xff7ad9, 0xfff17a, 0xc79aff, 0xff8a5c, 0x7affd6];

const index = new Map<string, number>();
export function teamColorIndex(teamId: string): number {
  let i = index.get(teamId);
  if (i === undefined) {
    i = index.size;
    index.set(teamId, i);
  }
  return i;
}
