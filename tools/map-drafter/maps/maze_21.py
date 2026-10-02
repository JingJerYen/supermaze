"""maze-21 "Candy House" (easy, candy): a modest maze whose big rooftop is
reached by two stairs, with two more onto the eastern rooftops; a few keys wait up there, so this is
the easy floor that teaches climbing onto the walls. No fixtures."""
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
c.maze(cells, seed=21, loops=8, start=(1, 1))
for x, y in [(cx, cy - 3), (cx, cy + 3)]:  # plaza gates north and south
    c.put(x, y)
rows = c.rows()

if "--explore" in sys.argv:
    explore("maze-21", rows)
    sys.exit()

finish("maze-21", rows,
       stairs=[(5, 7), (11, 11), (17, 3), (17, 11)],  # west and south onto the big rooftop, two more in the east
       doors=0, traps=0, obstacles=0, time=180,
       candidates=dict(n_keys=8, n_road_keys=5, n_boxes=10, n_box_top=1, n_switch=4, key_gap=4, wall_cap=1,
                       road_cap=3, box_gap=4, switch_gap=8, keys_on_dead_ends=False,
                       key_filter=lambda x, y, layer: abs(x - cx) + abs(y - cy) >= 6),
       meta=dict(difficulty="easy", boxes=6, switches=2, theme="candy"))
