"""Join the dead ends of a hand-edited map with bridges and stairs.

    python3 tools/map-drafter/undeadend.py night-01 [--dry]

A dead end is a tile with a single way out, on the road or on a wall top. Each
is tried in turn: a wall stub gets a bridge over the road to the wall facing it
or stairs down at its tip; a road dead end gets a bridge cut through the wall
to the road behind it. An edit is kept only when the map still checks clean and
has fewer dead ends than before; the best edit goes first and bridges win ties.
Markers and tiles next to the tower are never touched. Whatever is left is listed."""
import argparse
import json

import mapkit as mk

ap = argparse.ArgumentParser()
ap.add_argument("map_id")
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()


def dead_ends(rows):
    """None when the map has errors."""
    m = mk.Map(rows)
    if m.check(verbose=False):
        return None
    return sorted(p for p in m.fwd if sum(1 for _ in m.moves(*p, True)) == 1)


def edits(rows, x, y, layer):
    m = mk.Map(rows)
    near_tower = lambda p: any(m.cell(p[0] + i, p[1] + j) == "T" for i, j in mk.D4)
    for dx, dy in mk.D4:
        n1, n2 = (x + dx, y + dy), (x + 2 * dx, y + 2 * dy)
        if near_tower(n1):
            continue
        if layer == "w" and m.raw(*n1) == ".":
            if m.cell(*n2) == "#":
                yield (*n1, "=")
            yield (*n1, "S")
        if layer == "r" and m.raw(*n1) == "#" and m.cell(*n2) in ".S=":
            yield (*n1, "=")


path = mk.MAPS_DIR / f"{a.map_id}.json"
data = json.loads(path.read_text())
rows = data["rows"]
ends = dead_ends(rows)
if ends is None:
    raise SystemExit(f"{a.map_id} has errors; run check.py first")
print(f"== {a.map_id}: {len(ends)} dead ends")
while True:
    best = None
    for p in ends:
        for e in edits(rows, *p):
            left = dead_ends(mk.stamp(rows, [e]))
            if left is not None and len(left) < len(ends):
                rank = (len(left), e[2] != "=")
                if best is None or rank < best[0]:
                    best = (rank, e, left)
    if best is None:
        break
    _, e, ends = best
    rows = mk.stamp(rows, [e])
    print(f"  {'bridge' if e[2] == '=' else 'stairs'} at {e[0]},{e[1]} -> {len(ends)} left")
print("left:", ends or "none")
mk.key_report(rows)
if not a.dry:
    data["rows"] = rows
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    png = mk.OUT_DIR / f"{a.map_id}.png"
    mk.render(rows, png)
    print(f"wrote content/maps/{a.map_id}.json and {png.relative_to(mk.REPO)}")
