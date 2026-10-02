"""maze-16 "Old town": a street grid of 3x3 city blocks, the tower standing on
the middle block. Some streets are walled off, so the grid is a maze of
blocks rather than an open plan, and the walled streets join blocks into
bigger rooftops. Most keys are up on the roofs: stairs at street corners
and bridges over the streets make the roofs a second, quicker town."""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
xs, ys = [1, 5, 9, 13, 17, 21, 25, 29], [1, 5, 9, 13, 17, 21]
cross = [(x, y) for y in ys for x in xs]
# Street segments between neighbouring crossings: a random spanning tree plus
# some loops stays open; the rest are walled. The tower's ring is always open.
segs = [((x, y), (x2, y)) for x, x2 in zip(xs, xs[1:]) for y in ys] + \
       [((x, y), (x, y2)) for y, y2 in zip(ys, ys[1:]) for x in xs]
ring = lambda a, b: all(13 <= p[0] <= 17 and 9 <= p[1] <= 13 for p in (a, b))
rnd = random.Random(16)
rnd.shuffle(segs)
parent = {p: p for p in cross}
def root(p):
    while parent[p] != p:
        p = parent[p]
    return p
opened, spare = [], []
for a, b in sorted(segs, key=lambda s: not ring(*s)):  # the ring first, so it is always in
    if root(a) != root(b):
        parent[root(a)] = root(b)
        opened.append((a, b))
    else:
        spare.append((a, b))
opened += [s for s in spare if ring(*s)] + rnd.sample([s for s in spare if not ring(*s)], 5)
for (x, y), (x2, y2) in opened:
    if y == y2:
        c.hline(x, x2, y)
    else:
        c.vline(x, y, y2)
c.tower()
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-16", rows)
    sys.exit()

finish("maze-16", rows,
       stairs=[(9, 1), (21, 9), (25, 9), (1, 17), (13, 17), (29, 17)],
       bridges=[(23, 9), (17, 15), (5, 3), (13, 19)],  # over the streets, block to block
       doors=1, traps=2, obstacles=1, fseed=16, time=210,
       candidates=dict(n_keys=8, n_road_keys=3, n_boxes=14, n_box_top=2, n_switch=6, key_gap=5, wall_cap=2, road_cap=2,
                       keys_on_dead_ends=False),
       meta=dict(difficulty="medium", boxes=8, switches=4, theme="stone"))
