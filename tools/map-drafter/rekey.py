"""Move the key candidates of a hand-edited map back to hard spots.

    python3 tools/map-drafter/rekey.py maze-06 [--gap 7] [--dry]

New stairs and bridges shorten the walk to keys that used to be far away. This
keeps everything else in the JSON (terrain, boxes, switches, fixtures) and only
re-picks the keys: the same number on the road and on wall tops as before, on
the tiles that now take longest to walk to from the tower (no hammer), preferring
dead ends, spread out by --gap and capped per quadrant."""
import argparse
import json

import mapkit as mk

ap = argparse.ArgumentParser()
ap.add_argument("map_id")
ap.add_argument("--gap", type=int, default=7)
ap.add_argument("--dead-end-bonus", type=int, default=8)
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()

path = mk.MAPS_DIR / f"{a.map_id}.json"
data = json.loads(path.read_text())
old = data["rows"]
print(f"== {a.map_id}\nbefore: ", end="")
mk.key_report(old)
n_top = sum(r.count("k") for r in old)
n_road = sum(r.count("K") for r in old)
rows = [r.replace("K", ".").replace("k", "#") for r in old]

m = mk.Map(rows)
m.check(verbose=False)
d = m.fwd
entries = m.entries()
free = lambda x, y: (0 < x < m.w - 1 and 0 < y < m.h - 1 and rows[y][x] in ".#" and (x, y) not in entries
                     and not any(m.cell(x + i, y + j) == "T" for i, j in mk.D4))
deg = lambda p, layer: sum(1 for _ in m.moves(*p, layer, True))


def pick(layer, n, taken):
    """The farthest tiles; a dead end counts as --dead-end-bonus steps farther."""
    pool = sorted((x, y) for (x, y, l) in d if l == layer and free(x, y))
    cap = -(-n // 4) + 1
    score = lambda p: d[(p[0], p[1], layer)] + (a.dead_end_bonus if deg(p, layer) == 1 else 0)
    out = []
    for quad_cap in (cap, None):
        if len(out) < n:
            out += mk.spread_pick([p for p in pool if p not in out], n - len(out), a.gap, score,
                                  taken + out, quad_cap=quad_cap, centre=(m.cx, m.cy))
    return out


tops = pick("w", n_top, [])
roads = pick("r", n_road, tops)
if len(tops) < n_top or len(roads) < n_road:
    raise SystemExit(f"only found {len(tops)}/{n_top} wall-top and {len(roads)}/{n_road} road spots; lower --gap")
rows = mk.stamp(rows, [(x, y, "k") for x, y in tops] + [(x, y, "K") for x, y in roads])
if mk.Map(rows).check():
    raise SystemExit(1)
print("after:  ", end="")
mk.key_report(rows)
if not a.dry:
    data["rows"] = rows
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    png = mk.OUT_DIR / f"{a.map_id}.png"
    mk.render(rows, png)
    print(f"wrote content/maps/{a.map_id}.json and {png.relative_to(mk.REPO)}")
