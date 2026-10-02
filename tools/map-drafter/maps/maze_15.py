"""maze-15 "Hedge rings": four ring corridors round the tower, one inside the
other, like a garden labyrinth. Each ring is cut in places and the gates to
the next ring are staggered, so getting out means walking round; the hedge
tops between rings are long rooftop paths, and bridges across the rings are
the shortcut straight in or out. Narrow side mazes at the east and west ends
hold the farthest keys."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
c.tower()
cx, cy = c.cx, c.cy
rings = [(11, 19, 7, 15), (9, 21, 5, 17), (7, 23, 3, 19), (5, 25, 1, 21)]
for x0, x1, y0, y1 in rings:
    c.rect(x0, x1, y0, y1)
# Cuts: a ring is a C, not a loop, so you go round the long way.
for x, y in [(19, 11), (9, 13), (15, 5), (7, 9)]:
    c.put(x, y, "#")
# Gates, plaza -> ring 1 -> ring 2 -> ring 3 -> ring 4, staggered round the clock.
for x, y in [(15, 8), (15, 14),            # plaza to ring 1 (north, south)
             (10, 9), (20, 13),            # ring 1 to ring 2 (west, east)
             (13, 4), (17, 18),            # ring 2 to ring 3 (north, south)
             (6, 17), (24, 7),             # ring 3 to ring 4
             (20, 7), (8, 15), (19, 4), (6, 5)]:  # a second way through each, so it stays medium
    c.put(x, y)
# Side mazes beyond ring 4, each opening onto it in two places.
west = [(x, y) for y in range(1, 22, 2) for x in (1, 3)]
east = [(x, y) for y in range(1, 22, 2) for x in (27, 29)]
c.maze(west, seed=15, loops=2, start=(1, 1))
c.maze(east, seed=151, loops=2, start=(29, 21))
for x, y in [(4, 3), (4, 19), (26, 3), (26, 19)]:
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-15", rows)
    sys.exit()

finish("maze-15", rows,
       stairs=[(1, 9), (29, 13), (3, 11), (27, 17), (21, 13), (5, 19)],
       bridges=[(9, 11), (23, 11), (15, 17)],  # across the rings: straight in or out on the hedge tops
       doors=0, traps=2, obstacles=1, fseed=15, time=210,
       candidates=dict(n_keys=8, n_road_keys=4, n_boxes=14, n_box_top=2, n_switch=6, key_gap=5, wall_cap=2, road_cap=3,
                       key_filter=lambda x, y, layer: not (9 <= x <= 21 and 5 <= y <= 17)),  # none in the two inner rings
       meta=dict(difficulty="medium", boxes=8, switches=4, theme="garden"))
