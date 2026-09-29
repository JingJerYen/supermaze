"""Check and preview any map in content/maps, including hand-drawn ones.

    python3 tools/map-drafter/check.py maze-03 [--stairs] [--ruler]

Beyond `npm run validate-maps` it checks fixtures: no one-way door can trap a
player and every candidate is reachable without a hammer. It prints how many
steps each key is from the tower and writes out/<id>.png. --stairs lists where
stairs are legal, per wall-top region; --ruler prints the rows with coordinates."""
import argparse

import mapkit as mk

ap = argparse.ArgumentParser()
ap.add_argument("map_id")
ap.add_argument("--stairs", action="store_true")
ap.add_argument("--ruler", action="store_true")
a = ap.parse_args()

rows = mk.load_rows(a.map_id)
m = mk.Map(rows)
m.check()
mk.key_report(rows)
if a.stairs:
    comp, spots = m.stair_spots()
    sizes = {}
    for v in comp.values():
        sizes[v] = sizes.get(v, 0) + 1
    for k in sorted(spots, key=lambda k: -sizes[k]):
        print(f"wall-top region {k} ({sizes[k]} tiles): stairs possible at {spots[k]}")
if a.ruler:
    mk.ruler(rows)
png = mk.OUT_DIR / f"{a.map_id}.png"
mk.render(rows, png)
print("preview:", png.relative_to(mk.REPO))
