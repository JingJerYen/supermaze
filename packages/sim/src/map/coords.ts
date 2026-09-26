/**
 * Board-style tile coordinates for voice/text communication (CLAUDE.md section 7):
 * columns are letters from the left, rows are numbers from the top, both in the
 * orientation the round is played in, so every player names tiles the same way.
 */
export function columnLabel(x: number): string {
  // A..Z, then AA, AB, ... for very wide maps.
  let n = x;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function rowLabel(y: number): string {
  return String(y + 1);
}

export function tileLabel(x: number, y: number): string {
  return `${columnLabel(x)}${rowLabel(y)}`;
}
