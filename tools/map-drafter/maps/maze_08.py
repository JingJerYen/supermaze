"""maze-08 "Twin halves": a straight canyon road runs north-south through the
tower and out of both map edges, walled on both sides. The west half joins it
only at the far north, the east half only at the far south (plus a one-way
door into each at the other end), so changing sides on foot is a long walk;
two bridges over the canyon are the rooftop shortcut."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(31, 23)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
west = [(x, y) for y in range(1, 22, 2) for x in range(1, 14, 2) if not plaza(x, y)]
east = [(x, y) for y in range(1, 22, 2) for x in range(17, 30, 2) if not plaza(x, y)]
c.maze(west, seed=8, loops=6, start=(1, 1))
c.maze(east, seed=18, loops=6, start=(29, 21))
c.vline(cx, 0, 22)  # the canyon, through the plaza's north and south gates
for y in range(cy - 1, cy + 2):
    c.put(cx, y, "T")
c.put(14, 1); c.put(16, 21)  # the only two-way links between canyon and halves
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-08", rows)
    sys.exit()

finish("maze-08", rows,
       stairs=[(1, 9), (5, 19), (5, 3), (29, 5), (25, 17), (21, 13)],
       bridges=[(15, 4), (15, 18)],  # over the canyon: the rooftop way across
       manual=[(14, 21, "<"), (16, 1, ">")],  # one-way into each half at its far end
       doors=0, traps=2, obstacles=0, fseed=8, time=210,
       candidates=dict(n_keys=8, n_road_keys=4, n_boxes=14, n_box_top=2, n_switch=6, key_gap=6, wall_cap=2, road_cap=2),
       meta=dict(difficulty="medium", boxes=8, switches=4, theme="factory"))
