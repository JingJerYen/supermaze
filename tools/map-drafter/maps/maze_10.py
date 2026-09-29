"""maze-10 "Crossroads": four straight avenues run from the tower doors to the
map edges and cut the map into four small mazes. Avenues are the fast way
round but each holds fixed traps, and in a ghost event they are open hunting
ground while the quarter mazes are where you hide."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
quarters = {"NW": (1, 13, 1, 9), "NE": (17, 29, 1, 9), "SW": (1, 13, 13, 21), "SE": (17, 29, 13, 21)}
for i, (x0, x1, y0, y1) in enumerate(quarters.values()):
    cells = [(x, y) for y in range(y0, y1 + 1, 2) for x in range(x0, x1 + 1, 2) if not plaza(x, y)]
    c.maze(cells, seed=100 + i, loops=4, start=cells[0])
c.vline(cx, 1, 21)
c.hline(1, 29, cy)
for y in range(cy - 1, cy + 2):  # the avenues were drawn through the tower
    for x in range(cx - 1, cx + 2):
        c.put(x, y, "T")
# two ways into each quarter, both at the far ends of its avenues: you run the avenue first
for x, y in [(14, 1), (1, 10), (16, 3), (29, 10), (14, 19), (1, 12), (16, 21), (29, 12)]:
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-10", rows)
    sys.exit()

finish("maze-10", rows,
       stairs=[(3, 7), (25, 1), (1, 17), (29, 19), (19, 5)],
       manual=[(15, 5, "A"), (15, 17, "A"), (7, 11, "A"), (23, 11, "A"), (3, 11, "A"), (27, 11, "A")],  # avenue traps
       doors=0, traps=0, obstacles=0, time=210,
       candidates=dict(n_keys=8, n_road_keys=5, n_boxes=14, n_box_top=2, n_switch=6, key_gap=5, road_cap=3,
                       key_filter=lambda x, y, layer: x != 15 and y != 11),
       meta=dict(difficulty="medium", boxes=8, switches=4))
