"""maze-20 "Dunes" (easy, desert): a small maze opened up with many loops, so
there are few dead ends and a wrong turn always leads back round. No fixtures,
and every key is on the ground; the stairs are shortcuts along the outer wall
and onto two small rooftops."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mapkit as mk  # noqa: E402
from finish import explore, finish  # noqa: E402

c = mk.Canvas(23, 15)
c.tower()
cx, cy = c.cx, c.cy
plaza = lambda x, y: cx - 2 <= x <= cx + 2 and cy - 2 <= y <= cy + 2
cells = [(x, y) for y in range(1, 14, 2) for x in range(1, 22, 2) if not plaza(x, y)]
c.maze(cells, seed=20, loops=22, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3), (cx - 3, cy), (cx + 3, cy)]:  # plaza gates
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-20", rows)
    sys.exit()

finish("maze-20", rows,
       stairs=[(1, 7), (19, 7), (7, 3), (7, 11)],  # outer-wall shortcuts east and west, two small rooftops; no keys up there
       doors=0, traps=0, obstacles=0, time=180,
       candidates=dict(n_keys=8, n_road_keys=8, n_boxes=10, n_box_top=0, n_switch=4, key_gap=4, wall_cap=1,
                       road_cap=3, box_gap=4, switch_gap=8, keys_on_dead_ends=False,
                       key_filter=lambda x, y, layer: abs(x - cx) + abs(y - cy) >= 7),
       meta=dict(difficulty="easy", boxes=6, switches=2, theme="desert"))
