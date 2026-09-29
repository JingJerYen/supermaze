"""maze-13 "Hammer gates": a ring road round the tower, a perimeter road round
the map and four straight spokes between them cut the map into four quarter
mazes. Each quarter's two near gates (one off the ring, one off a spoke) are
blocked by fixed obstacles; the open gate is at its far corner, off the
perimeter. A hammer saves a long walk, and the item boxes sit along that walk.
Wall tops of neighbouring quarters are bridged over the spokes."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas()
c.tower()
cx, cy = c.cx, c.cy
ring = (cx - 4, cx + 4, cy - 4, cy + 4)  # x17..25, y11..19
in_ring = lambda x, y: ring[0] <= x <= ring[1] and ring[2] <= y <= ring[3]
QUARTERS = {"NW": (3, 19, 3, 13), "NE": (23, 39, 3, 13), "SW": (3, 19, 17, 27), "SE": (23, 39, 17, 27)}
for i, (x0, x1, y0, y1) in enumerate(QUARTERS.values()):
    cells = [(x, y) for y in range(y0, y1 + 1, 2) for x in range(x0, x1 + 1, 2) if not in_ring(x, y)]
    c.maze(cells, seed=130 + i, loops=3, start=cells[0])
c.rect(*ring)
c.rect(1, c.w - 2, 1, c.h - 2)  # perimeter road
c.vline(cx, 1, ring[2]); c.vline(cx, ring[3], c.h - 2)  # spokes
c.hline(1, ring[0], cy); c.hline(ring[1], c.w - 2, cy)
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates through the rampart
    c.put(x, y)
FAR_GATES = [(2, 3), (40, 3), (2, 27), (40, 27)]
HAMMER_GATES = [(16, 13), (20, 5), (26, 13), (22, 7), (16, 17), (5, 16), (26, 17), (37, 16)]
for x, y in FAR_GATES + HAMMER_GATES:
    c.put(x, y)
rows = c.rows()
on_detour = lambda x, y: x in (1, c.w - 2, cx) or y in (1, c.h - 2, cy) or (in_ring(x, y) and (x in ring[:2] or y in ring[2:]))

STAIRS = [(11, 9), (37, 3), (9, 23), (33, 27), (29, 21)]  # inside the quarters, onto their wall tops
BRIDGES = [(21, 3), (21, 27), (3, 15), (39, 15)]  # quarter rooftops, over the spokes
if "--explore" in sys.argv:
    explore("maze-13", mk.stamp(rows, [(x, y, "=") for x, y in BRIDGES]))
    sys.exit()

finish("maze-13", rows, stairs=STAIRS, bridges=BRIDGES,
       manual=[(x, y, "O") for x, y in HAMMER_GATES],
       doors=0, traps=3, obstacles=0, fseed=13, time=300,
       candidates=dict(n_keys=11, n_road_keys=7, key_gap=7, wall_cap=2, road_cap=3, box_filter=on_detour,
                       key_filter=lambda x, y, layer: not (layer == "r" and on_detour(x, y))))
