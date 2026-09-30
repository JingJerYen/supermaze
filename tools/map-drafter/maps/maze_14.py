"""maze-14 "Trap galleries": a maze carved with a strong east-west preference, so
it is made of long galleries with short north-south links. Fixed traps line the
galleries every few tiles. Traps are single-use: the first runner down a gallery
gets caught and clears it for whoever follows."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas()
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
cells = [(x, y) for y in range(1, c.h - 1, 2) for x in range(1, c.w - 1, 2) if not plaza(x, y)]
c.maze(cells, seed=14, bias=lambda a, b: 10 if a[1] == b[1] else 1, loops=12, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:
    c.put(x, y)
rows = c.rows()

STAIRS = [(1, 5), (41, 5), (1, 21), (37, 29), (21, 11), (9, 27)]  # last two: small wall islands
if "--explore" in sys.argv:
    explore("maze-14", rows)
    sys.exit()

finish("maze-14", rows, stairs=STAIRS,
       doors=3, traps=10, obstacles=1, fseed=14, time=300,
       candidates=dict(n_keys=11, n_road_keys=6, key_gap=7, wall_cap=2, road_cap=3))
